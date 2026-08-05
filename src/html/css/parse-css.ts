import * as cssParser from "css";
import { createSelectorMatcher, type DomLikeElement } from "../../css/selectors/matcher.js";
import { computeSpecificity, type Specificity } from "../../css/selectors/specificity.js";

import type { DomElement } from "../../types/core.js";

export type DomEl = DomElement;
export type CssPseudoElement = "::before" | "::after";

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

export function buildCssRules(cssText: string): ParsedCss {
  const result: ParsedCss = { styleRules: [], fontFaceRules: [] };
  if (!cssText.trim()) {
    return result;
  }
  const stylesheet = cssParser.parse(cssText);
  const rules = stylesheet.stylesheet?.rules ?? [];
  let styleRuleSourceOrder = 0;

  for (const rule of rules) {
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
    } else if (rule.type === "font-face") {
      const typedRule = rule as CssFontFaceRule;
      const decls = (typedRule.declarations ?? []).filter(
        (declaration): declaration is CssDeclaration => declaration.type === "declaration",
      );
      result.fontFaceRules.push({ declarations: parseFontFaceDeclarations(decls) });
    }
  }
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

export function parseCss(cssText: string): ParsedCss {
  return buildCssRules(cssText);
}
