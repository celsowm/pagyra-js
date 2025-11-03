import * as cssParser from "css";
import { createSelectorMatcher } from "../../css/selectors/matcher.js";

export type DomEl = any; // adapt to your DOM type, e.g. HTMLElement or any

export interface CssRuleEntry {
  selector: string;
  declarations: Record<string,string>;
  match: (el: DomEl) => boolean;
}

type CssDeclaration = cssParser.Declaration;
type CssRule = cssParser.Rule;

export function buildCssRules(cssText: string): CssRuleEntry[] {
  if (!cssText.trim()) {
    return [];
  }
  const stylesheet = cssParser.parse(cssText);
  const result: CssRuleEntry[] = [];
  const rules = stylesheet.stylesheet?.rules ?? [];
  for (const rule of rules) {
    if (rule.type !== "rule") {
      continue;
    }
    const typedRule = rule as CssRule;
    const selectors = typedRule.selectors ?? [];
    const decls = typedRule.declarations ?? [];
    const declarations: Record<string, string> = {};
    for (const decl of decls) {
      if (!decl || decl.type !== "declaration") {
        continue;
      }
      const declaration = decl as CssDeclaration;
      if (!declaration.property || declaration.value === undefined) {
        continue;
      }
      declarations[declaration.property.trim().toLowerCase()] = declaration.value.trim();
    }
    for (const selector of selectors) {
      const matcher = createSelectorMatcher(selector.trim());
      if (!matcher) {
        console.warn(`Invalid CSS selector: ${selector.trim()}`);
        continue;
      }
      result.push({ selector, declarations: { ...declarations }, match: matcher });
    }
  }
  return result;
}

export function parseCss(cssText: string): CssRuleEntry[] {
  return buildCssRules(cssText);
}
