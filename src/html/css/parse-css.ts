import * as cssParser from "css";
import { createSelectorMatcher } from "../../css/selectors/matcher.js";

import type { DomElement } from "../../types/core.js";

export type DomEl = DomElement;

export interface CssRuleEntry {
  selector: string;
  declarations: Record<string, string>;
  match: (el: DomEl) => boolean;
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
        const matcher = createSelectorMatcher(selector.trim());
        if (!matcher) {
          console.warn(`Invalid CSS selector: ${selector.trim()}`);
          continue;
        }
        result.styleRules.push({ selector, declarations: { ...declarations }, match: matcher });
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

export function parseCss(cssText: string): ParsedCss {
  return buildCssRules(cssText);
}
