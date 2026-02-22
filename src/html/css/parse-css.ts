import * as cssParser from "css";
import { createSelectorMatcher, type DomLikeElement } from "../../css/selectors/matcher.js";

import type { DomElement } from "../../types/core.js";

export type DomEl = DomElement;
export type CssPseudoElement = "::before" | "::after";

export interface CssRuleEntry {
  selector: string;
  declarations: Record<string, string>;
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

export function buildCssRules(cssText: string): ParsedCss {
  const result: ParsedCss = { styleRules: [], fontFaceRules: [] };
  if (!cssText.trim()) {
    return result;
  }
  const stylesheet = cssParser.parse(cssText);
  const rules = stylesheet.stylesheet?.rules ?? [];

  for (const rule of rules) {
    if (rule.type === "rule") {
      const typedRule = rule as CssRule;
      const selectors = typedRule.selectors ?? [];
      const decls = typedRule.declarations ?? [];
      const declarations: Record<string, string> = {};
      for (const decl of decls) {
        if (decl.type !== "declaration") continue;
        const declaration = decl as CssDeclaration;
        if (!declaration.property || declaration.value === undefined) {
          continue;
        }
        const prop = declaration.property.trim();
        if (prop.startsWith('--')) {
          declarations[prop] = declaration.value.trim();
        } else {
          declarations[prop.toLowerCase()] = declaration.value.trim();
        }
      }
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
          declarations: { ...declarations },
          match: matcher,
          pseudoElement: parsedSelector.pseudoElement,
        });
      }
    } else if (rule.type === "font-face") {
      const typedRule = rule as CssFontFaceRule;
      const decls = typedRule.declarations ?? [];
      const declarations: Record<string, string> = {};
      for (const decl of decls) {
        if (decl.type !== "declaration") continue;
        const declaration = decl as CssDeclaration;
        if (!declaration.property || declaration.value === undefined) {
          continue;
        }
        const prop = declaration.property.trim();
        if (prop.startsWith('--')) {
          declarations[prop] = declaration.value.trim();
        } else {
          declarations[prop.toLowerCase()] = declaration.value.trim();
        }
      }
      result.fontFaceRules.push({ declarations });
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
