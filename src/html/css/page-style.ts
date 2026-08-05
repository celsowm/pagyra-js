import type { CssDeclarationEntry, CssPageRuleEntry } from "./parse-css.js";
import { inToPx, mmToPx } from "../../units/units.js";
import { parseLength } from "../../css/parsers/length-parser.js";
import type { PageMarginsPx } from "../../units/page-utils.js";

export interface ResolvedPageStyle {
  width?: number;
  height?: number;
  margins?: Partial<PageMarginsPx>;
}

interface PageSize {
  width: number;
  height: number;
}

const NAMED_PAGE_SIZES: Readonly<Record<string, PageSize>> = {
  a5: { width: mmToPx(148), height: mmToPx(210) },
  a4: { width: mmToPx(210), height: mmToPx(297) },
  a3: { width: mmToPx(297), height: mmToPx(420) },
  b5: { width: mmToPx(176), height: mmToPx(250) },
  b4: { width: mmToPx(250), height: mmToPx(353) },
  "jis-b5": { width: mmToPx(182), height: mmToPx(257) },
  "jis-b4": { width: mmToPx(257), height: mmToPx(364) },
  letter: { width: inToPx(8.5), height: inToPx(11) },
  legal: { width: inToPx(8.5), height: inToPx(14) },
  ledger: { width: inToPx(17), height: inToPx(11) },
  tabloid: { width: inToPx(11), height: inToPx(17) },
};

/**
 * Resolves the unqualified @page cascade used as the document-wide page style.
 * Named pages and page pseudo-classes are intentionally left for the future
 * per-page fragmentation pipeline.
 */
export function resolveDefaultPageStyle(
  pageRules: readonly CssPageRuleEntry[],
  fallbackSize: PageSize,
): ResolvedPageStyle {
  let size: PageSize | undefined;
  const margins: Partial<PageMarginsPx> = {};
  let hasMargin = false;

  const orderedRules = [...pageRules]
    .filter(isDefaultPageRule)
    .sort((left, right) => (left.sourceOrder ?? 0) - (right.sourceOrder ?? 0));

  for (const rule of orderedRules) {
    const declarations = rule.orderedDeclarations ?? declarationsFromMap(rule.declarations);
    for (const declaration of declarations) {
      switch (declaration.property.toLowerCase()) {
        case "size": {
          const resolved = parsePageSize(declaration.value, size ?? fallbackSize);
          if (resolved) {
            size = resolved;
          }
          break;
        }
        case "margin": {
          const resolved = parseMarginShorthand(declaration.value);
          if (resolved) {
            Object.assign(margins, resolved);
            hasMargin = true;
          }
          break;
        }
        case "margin-top":
        case "margin-right":
        case "margin-bottom":
        case "margin-left": {
          const resolved = parseAbsolutePageLength(declaration.value);
          if (resolved !== undefined) {
            const side = declaration.property.slice("margin-".length) as keyof PageMarginsPx;
            margins[side] = Math.max(0, resolved);
            hasMargin = true;
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return {
    width: size?.width,
    height: size?.height,
    margins: hasMargin ? margins : undefined,
  };
}

function isDefaultPageRule(rule: CssPageRuleEntry): boolean {
  return !rule.selectors || rule.selectors.length === 0 || rule.selectors.every((selector) => !selector.trim());
}

function declarationsFromMap(declarations: Record<string, string>): CssDeclarationEntry[] {
  return Object.entries(declarations).map(([property, value], sourceOrder) => ({
    property,
    value,
    important: false,
    sourceOrder,
  }));
}

function parsePageSize(value: string, fallback: PageSize): PageSize | undefined {
  const tokens = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.includes("auto")) {
    return undefined;
  }

  let orientation: "portrait" | "landscape" | undefined;
  const orientationIndex = tokens.findIndex((token) => token === "portrait" || token === "landscape");
  if (orientationIndex >= 0) {
    orientation = tokens[orientationIndex] as "portrait" | "landscape";
    tokens.splice(orientationIndex, 1);
  }

  let size: PageSize | undefined;
  if (tokens.length === 0) {
    size = { ...fallback };
  } else if (tokens.length === 1) {
    const named = NAMED_PAGE_SIZES[tokens[0]];
    if (named) {
      size = { ...named };
    } else {
      const side = parseAbsolutePageLength(tokens[0]);
      if (side !== undefined && side > 0) {
        size = { width: side, height: side };
      }
    }
  } else if (tokens.length === 2) {
    const width = parseAbsolutePageLength(tokens[0]);
    const height = parseAbsolutePageLength(tokens[1]);
    if (width !== undefined && height !== undefined && width > 0 && height > 0) {
      size = { width, height };
    }
  }

  if (!size || !orientation) {
    return size;
  }
  if (orientation === "landscape" && size.width < size.height) {
    return { width: size.height, height: size.width };
  }
  if (orientation === "portrait" && size.width > size.height) {
    return { width: size.height, height: size.width };
  }
  return size;
}

function parseMarginShorthand(value: string): PageMarginsPx | undefined {
  const values = value.trim().split(/\s+/).filter(Boolean).map(parseAbsolutePageLength);
  if (values.length < 1 || values.length > 4 || values.some((entry) => entry === undefined)) {
    return undefined;
  }

  const [top, right = top, bottom = top, left = right] = values as number[];
  if (values.length === 3) {
    return {
      top: Math.max(0, top),
      right: Math.max(0, right),
      bottom: Math.max(0, bottom),
      left: Math.max(0, right),
    };
  }
  return {
    top: Math.max(0, top),
    right: Math.max(0, right),
    bottom: Math.max(0, bottom),
    left: Math.max(0, left),
  };
}

function parseAbsolutePageLength(value: string): number | undefined {
  const parsed = parseLength(value);
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
}
