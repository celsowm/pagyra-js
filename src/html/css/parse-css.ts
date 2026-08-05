import * as cssParser from "css";
import { createSelectorMatcher, type DomLikeElement } from "../../css/selectors/matcher.js";
import { computeSpecificity, type Specificity } from "../../css/selectors/specificity.js";

import type { DomElement } from "../../types/core.js";

export type DomEl = DomElement;
export type CssPseudoElement = "::before" | "::after";
export type CssMediaType = "print" | "screen";

export interface CssParseOptions {
  mediaType?: CssMediaType;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface CssDeclarationEntry {
  property: string;
  value: string;
  important: boolean;
  sourceOrder: number;
}

export interface CssRuleEntry {
  selector: string;
  declarations: Record<string, string>;
  orderedDeclarations?: readonly CssDeclarationEntry[];
  specificity?: Specificity;
  sourceOrder?: number;
  match: (el: DomLikeElement) => boolean;
  pseudoElement?: CssPseudoElement;
}

export interface FontFaceRule {
  declarations: Record<string, string>;
}

export interface ParsedCss {
  styleRules: CssRuleEntry[];
  fontFaceRules: FontFaceRule[];
}

type CssDeclaration = cssParser.Declaration;
type CssRule = cssParser.Rule;
type CssFontFaceRule = cssParser.FontFace;

interface ParsedDeclarationBlock {
  declarations: Record<string, string>;
  orderedDeclarations: CssDeclarationEntry[];
}

interface NormalizedCssParseOptions {
  mediaType: CssMediaType;
  viewportWidth?: number;
  viewportHeight?: number;
}

function normalizeProperty(property: string): string {
  const trimmed = property.trim();
  return trimmed.startsWith("--") ? trimmed : trimmed.toLowerCase();
}

function splitImportant(value: string): { value: string; important: boolean } {
  const match = /!\s*important\s*$/i.exec(value);
  if (!match || match.index === undefined) {
    return { value: value.trim(), important: false };
  }
  return {
    value: value.slice(0, match.index).trim(),
    important: true,
  };
}

function parseDeclarationBlock(declarations: readonly cssParser.Declaration[]): ParsedDeclarationBlock {
  const declarationMap: Record<string, string> = {};
  const orderedDeclarations: CssDeclarationEntry[] = [];

  for (const declaration of declarations) {
    if (!declaration.property || declaration.value === undefined) {
      continue;
    }

    const property = normalizeProperty(declaration.property);
    const rawValue = declaration.value.trim();
    const parsedValue = splitImportant(rawValue);

    declarationMap[property] = rawValue;
    orderedDeclarations.push({
      property,
      value: parsedValue.value,
      important: parsedValue.important,
      sourceOrder: orderedDeclarations.length,
    });
  }

  return {
    declarations: declarationMap,
    orderedDeclarations,
  };
}

function parseFontFaceDeclarations(declarations: readonly cssParser.Declaration[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const declaration of declarations) {
    if (!declaration.property || declaration.value === undefined) {
      continue;
    }
    result[normalizeProperty(declaration.property)] = declaration.value.trim();
  }
  return result;
}

function splitMediaQueryList(value: string): string[] {
  const queries: string[] = [];
  let current = "";
  let parenthesesDepth = 0;

  for (const character of value) {
    if (character === "(") {
      parenthesesDepth++;
      current += character;
      continue;
    }
    if (character === ")") {
      parenthesesDepth = Math.max(0, parenthesesDepth - 1);
      current += character;
      continue;
    }
    if (character === "," && parenthesesDepth === 0) {
      if (current.trim()) {
        queries.push(current.trim());
      }
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim()) {
    queries.push(current.trim());
  }
  return queries;
}

function mediaLengthToPx(value: string): number | undefined {
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|pt|in|cm|mm|q)?$/i.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const numericValue = Number(match[1]);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }
  const unit = (match[2] ?? (numericValue === 0 ? "px" : "")).toLowerCase();
  switch (unit) {
    case "px":
      return numericValue;
    case "pt":
      return numericValue * (96 / 72);
    case "in":
      return numericValue * 96;
    case "cm":
      return numericValue * (96 / 2.54);
    case "mm":
      return numericValue * (96 / 25.4);
    case "q":
      return numericValue * (96 / 101.6);
    default:
      return undefined;
  }
}

function evaluateMediaFeature(feature: string, options: NormalizedCssParseOptions): boolean {
  const normalized = feature.trim().toLowerCase();
  const orientationMatch = /^\(\s*orientation\s*:\s*(portrait|landscape)\s*\)$/.exec(normalized);
  if (orientationMatch) {
    if (options.viewportWidth === undefined || options.viewportHeight === undefined) {
      return false;
    }
    const orientation = options.viewportWidth > options.viewportHeight ? "landscape" : "portrait";
    return orientation === orientationMatch[1];
  }

  const dimensionMatch = /^\(\s*(min-|max-)?(width|height)\s*:\s*([^)]+)\)$/.exec(normalized);
  if (!dimensionMatch) {
    return false;
  }

  const modifier = dimensionMatch[1] ?? "";
  const dimension = dimensionMatch[2] === "width" ? options.viewportWidth : options.viewportHeight;
  const expected = mediaLengthToPx(dimensionMatch[3]);
  if (dimension === undefined || expected === undefined) {
    return false;
  }

  if (modifier === "min-") {
    return dimension >= expected;
  }
  if (modifier === "max-") {
    return dimension <= expected;
  }
  return Math.abs(dimension - expected) < 0.01;
}

function matchesSingleMediaQuery(query: string, options: NormalizedCssParseOptions): boolean {
  let normalized = query.trim().toLowerCase();
  let negated = false;

  if (normalized.startsWith("not ")) {
    negated = true;
    normalized = normalized.slice(4).trim();
  } else if (normalized.startsWith("only ")) {
    normalized = normalized.slice(5).trim();
  }

  let mediaType = "all";
  const mediaTypeMatch = /^(all|print|screen)\b/.exec(normalized);
  if (mediaTypeMatch) {
    mediaType = mediaTypeMatch[1];
    normalized = normalized.slice(mediaTypeMatch[0].length).trim();
  }

  if (normalized.startsWith("and ")) {
    normalized = normalized.slice(4).trim();
  }

  const typeMatches = mediaType === "all" || mediaType === options.mediaType;
  const featuresMatch = !normalized
    || normalized
      .split(/\s+and\s+/i)
      .every((feature) => evaluateMediaFeature(feature, options));
  const matches = typeMatches && featuresMatch;
  return negated ? !matches : matches;
}

function matchesMediaQueryList(queryList: string, options: NormalizedCssParseOptions): boolean {
  return splitMediaQueryList(queryList).some((query) => matchesSingleMediaQuery(query, options));
}

function isAstRule(value: unknown): value is { type: string } {
  return typeof value === "object"
    && value !== null
    && "type" in value
    && typeof (value as { type?: unknown }).type === "string";
}

export function buildCssRules(cssText: string, options: CssParseOptions = {}): ParsedCss {
  const result: ParsedCss = { styleRules: [], fontFaceRules: [] };
  if (!cssText.trim()) {
    return result;
  }

  const normalizedOptions: NormalizedCssParseOptions = {
    mediaType: options.mediaType ?? "print",
    viewportWidth: options.viewportWidth,
    viewportHeight: options.viewportHeight,
  };
  const stylesheet = cssParser.parse(cssText);
  const rules = stylesheet.stylesheet?.rules ?? [];
  let styleRuleSourceOrder = 0;

  const processRules = (rulesToProcess: readonly unknown[]): void => {
    for (const rule of rulesToProcess) {
      if (!isAstRule(rule)) {
        continue;
      }

      if (rule.type === "rule") {
        const typedRule = rule as CssRule;
        const selectors = typedRule.selectors ?? [];
        const decls = (typedRule.declarations ?? []).filter(
          (declaration): declaration is CssDeclaration => declaration.type === "declaration",
        );
        const parsedDeclarations = parseDeclarationBlock(decls);

        for (const selector of selectors) {
          const trimmedSelector = selector.trim();
          const parsedSelector = splitTerminalPseudoElement(trimmedSelector);
          if (parsedSelector.unsupportedPseudo) {
            console.warn(`Unsupported pseudo-element selector: ${trimmedSelector}`);
            continue;
          }
          const matcher = createSelectorMatcher(parsedSelector.baseSelector);
          if (!matcher) {
            console.warn(`Invalid CSS selector: ${trimmedSelector}`);
            continue;
          }
          result.styleRules.push({
            selector,
            declarations: { ...parsedDeclarations.declarations },
            orderedDeclarations: parsedDeclarations.orderedDeclarations.map((declaration) => ({ ...declaration })),
            specificity: computeSpecificity(parsedSelector.baseSelector),
            sourceOrder: styleRuleSourceOrder,
            match: matcher,
            pseudoElement: parsedSelector.pseudoElement,
          });
        }
        styleRuleSourceOrder++;
        continue;
      }

      if (rule.type === "font-face") {
        const typedRule = rule as CssFontFaceRule;
        const decls = (typedRule.declarations ?? []).filter(
          (declaration): declaration is CssDeclaration => declaration.type === "declaration",
        );
        result.fontFaceRules.push({ declarations: parseFontFaceDeclarations(decls) });
        continue;
      }

      if (rule.type === "media") {
        const mediaRule = rule as { media?: string; rules?: unknown[] };
        if (mediaRule.media && matchesMediaQueryList(mediaRule.media, normalizedOptions)) {
          processRules(mediaRule.rules ?? []);
        }
      }
    }
  };

  processRules(rules);
  return result;
}

function splitTerminalPseudoElement(selector: string): {
  baseSelector: string;
  pseudoElement?: CssPseudoElement;
  unsupportedPseudo?: string;
} {
  const trimmed = selector.trim();
  const supported = /(.*?)(::?before|::?after)\s*$/i.exec(trimmed);
  if (supported) {
    const pseudoRaw = supported[2].toLowerCase();
    const pseudoElement: CssPseudoElement = pseudoRaw.endsWith("before") ? "::before" : "::after";
    const baseSelector = (supported[1].trim() || "*");
    return { baseSelector, pseudoElement };
  }

  const unsupported = /(.*?)(::[a-z-]+)\s*$/i.exec(trimmed);
  if (unsupported) {
    return {
      baseSelector: unsupported[1].trim() || "*",
      unsupportedPseudo: unsupported[2].toLowerCase(),
    };
  }

  return { baseSelector: trimmed || "*" };
}

export function parseCss(cssText: string, options: CssParseOptions = {}): ParsedCss {
  return buildCssRules(cssText, options);
}
