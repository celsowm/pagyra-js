import * as cssParser from "css";

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
        continue;
      }
      result.push({ selector, declarations: { ...declarations }, match: matcher });
    }
  }
  return result;
}

function createSelectorMatcher(selector: string): ((element: DomEl) => boolean) | null {
  if (!selector || selector.includes(" ")) {
    return null;
  }

  let working = selector;
  let id: string | null = null;
  const classes: string[] = [];

  const idMatch = working.match(/#[^.#]+/g);
  if (idMatch) {
    id = idMatch[0].slice(1);
    working = working.replace(idMatch[0], "");
  }

  const classMatches = working.match(/\.[^.#]+/g) ?? [];
  for (const cls of classMatches) {
    classes.push(cls.slice(1));
    working = working.replace(cls, "");
  }

  const tag = working.length > 0 ? working.toLowerCase() : null;

  return (element: DomEl) => {
    if (tag && element.tagName.toLowerCase() !== tag) {
      return false;
    }
    if (id && element.id !== id) {
      return false;
    }
    for (const cls of classes) {
      if (!element.classList.contains(cls)) {
        return false;
      }
    }
    return true;
  };
}

export function parseCss(cssText: string): CssRuleEntry[] {
  return buildCssRules(cssText);
}
