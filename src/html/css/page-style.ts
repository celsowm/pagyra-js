import type { CssDeclarationEntry, CssPageRuleEntry } from "./parse-css.js";
import { inToPx, mmToPx } from "../../units/units.js";
import { parseLength } from "../../css/parsers/length-parser.js";
import type { PageMarginsPx } from "../../units/page-utils.js";

export interface ResolvedPageStyle {
  width?: number;
  height?: number;
  margins?: Partial<PageMarginsPx>;
}

export interface ResolvedPageStyleProfile {
  default: ResolvedPageStyle;
  first: ResolvedPageStyle;
  left: ResolvedPageStyle;
  right: ResolvedPageStyle;
}

interface PageSize {
  width: number;
  height: number;
}

type PagePseudoClass = "first" | "left" | "right";
type MarginSide = keyof PageMarginsPx;

interface DeclarationCandidate<T> {
  value: T;
  important: boolean;
  specificity: number;
  ruleSourceOrder: number;
  declarationSourceOrder: number;
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

/** Resolves the document page size and all supported page pseudo-class margins. */
export function resolvePageStyleProfile(
  pageRules: readonly CssPageRuleEntry[],
  fallbackSize: PageSize,
): ResolvedPageStyleProfile {
  return {
    default: resolvePageStyle(pageRules, new Set(), fallbackSize),
    first: resolvePageStyle(pageRules, new Set<PagePseudoClass>(["first", "right"]), fallbackSize),
    left: resolvePageStyle(pageRules, new Set<PagePseudoClass>(["left"]), fallbackSize),
    right: resolvePageStyle(pageRules, new Set<PagePseudoClass>(["right"]), fallbackSize),
  };
}

/** Backward-compatible resolver for the unqualified document-wide @page style. */
export function resolveDefaultPageStyle(
  pageRules: readonly CssPageRuleEntry[],
  fallbackSize: PageSize,
): ResolvedPageStyle {
  return resolvePageStyleProfile(pageRules, fallbackSize).default;
}

function resolvePageStyle(
  pageRules: readonly CssPageRuleEntry[],
  pseudoClasses: ReadonlySet<PagePseudoClass>,
  fallbackSize: PageSize,
): ResolvedPageStyle {
  let sizeCandidate: DeclarationCandidate<string> | undefined;
  const marginCandidates: Partial<Record<MarginSide, DeclarationCandidate<number>>> = {};

  for (const rule of pageRules) {
    const specificity = matchingPageSpecificity(rule, pseudoClasses);
    if (specificity === undefined) {
      continue;
    }

    const declarations = rule.orderedDeclarations ?? declarationsFromMap(rule.declarations);
    for (const declaration of declarations) {
      const property = declaration.property.toLowerCase();
      const candidateBase = {
        important: declaration.important,
        specificity,
        ruleSourceOrder: rule.sourceOrder ?? 0,
        declarationSourceOrder: declaration.sourceOrder,
      };

      if (property === "size" && specificity === 0) {
        const candidate: DeclarationCandidate<string> = {
          ...candidateBase,
          value: declaration.value,
        };
        if (winsCascade(candidate, sizeCandidate)) {
          sizeCandidate = candidate;
        }
        continue;
      }

      if (property === "margin") {
        const parsed = parseMarginShorthand(declaration.value);
        if (!parsed) {
          continue;
        }
        for (const side of ["top", "right", "bottom", "left"] as const) {
          setMarginCandidate(marginCandidates, side, parsed[side], candidateBase);
        }
        continue;
      }

      if (
        property === "margin-top"
        || property === "margin-right"
        || property === "margin-bottom"
        || property === "margin-left"
      ) {
        const parsed = parseAbsolutePageLength(declaration.value);
        if (parsed === undefined) {
          continue;
        }
        const side = property.slice("margin-".length) as MarginSide;
        setMarginCandidate(marginCandidates, side, Math.max(0, parsed), candidateBase);
      }
    }
  }

  const size = sizeCandidate ? parsePageSize(sizeCandidate.value, fallbackSize) : undefined;
  const margins: Partial<PageMarginsPx> = {};
  let hasMargin = false;
  for (const side of ["top", "right", "bottom", "left"] as const) {
    const candidate = marginCandidates[side];
    if (candidate) {
      margins[side] = candidate.value;
      hasMargin = true;
    }
  }

  return {
    width: size?.width,
    height: size?.height,
    margins: hasMargin ? margins : undefined,
  };
}

function setMarginCandidate(
  candidates: Partial<Record<MarginSide, DeclarationCandidate<number>>>,
  side: MarginSide,
  value: number,
  base: Omit<DeclarationCandidate<number>, "value">,
): void {
  const candidate: DeclarationCandidate<number> = { ...base, value };
  if (winsCascade(candidate, candidates[side])) {
    candidates[side] = candidate;
  }
}

function winsCascade<T>(
  candidate: DeclarationCandidate<T>,
  current: DeclarationCandidate<T> | undefined,
): boolean {
  if (!current) {
    return true;
  }
  if (candidate.important !== current.important) {
    return candidate.important;
  }
  if (candidate.specificity !== current.specificity) {
    return candidate.specificity > current.specificity;
  }
  if (candidate.ruleSourceOrder !== current.ruleSourceOrder) {
    return candidate.ruleSourceOrder > current.ruleSourceOrder;
  }
  return candidate.declarationSourceOrder >= current.declarationSourceOrder;
}

function matchingPageSpecificity(
  rule: CssPageRuleEntry,
  pseudoClasses: ReadonlySet<PagePseudoClass>,
): number | undefined {
  if (isDefaultPageRule(rule)) {
    return 0;
  }

  let matched = false;
  for (const selector of rule.selectors ?? []) {
    const match = /^:(first|left|right)$/i.exec(selector.trim());
    if (match && pseudoClasses.has(match[1].toLowerCase() as PagePseudoClass)) {
      matched = true;
    }
  }
  return matched ? 1 : undefined;
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
