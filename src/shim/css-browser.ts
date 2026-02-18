/**
 * Browser shim for css - provides CSS parsing using browser APIs
 * This replaces the Node.js css package in browser builds.
 *
 * The returned AST must match the shape produced by the Node.js `css` package
 * so that parse-css.ts can consume it without any platform-specific branches.
 */

interface CSSDeclaration {
  type: string;        // always "declaration"
  property: string;
  value: string;
}

interface CSSRuleNode {
  type: string;        // "rule" | "font-face"
  selectors?: string[];
  declarations?: CSSDeclaration[];
  rules?: CSSRuleNode[];
  media?: string;
}

interface CSSParseResult {
  type: string;
  stylesheet?: {
    rules: CSSRuleNode[];
  };
}

function extractDeclarations(style: CSSStyleDeclaration): CSSDeclaration[] {
  const declarations: CSSDeclaration[] = [];
  for (let j = 0; j < style.length; j++) {
    const prop = style[j];
    declarations.push({
      type: "declaration",
      property: prop,
      value: style.getPropertyValue(prop),
    });
  }
  return declarations;
}

/**
 * Parse CSS text into an AST-like structure
 * Compatible with the Node.js css package's parse() function
 */
export function parse(cssText: string): CSSParseResult {
  const style = document.createElement("style");
  style.textContent = cssText;
  document.head.appendChild(style);

  const sheet = style.sheet;
  const rules: CSSRuleNode[] = [];

  if (sheet) {
    const cssRules = sheet.cssRules || [];
    for (let i = 0; i < cssRules.length; i++) {
      const rule = cssRules[i];

      if (rule instanceof CSSStyleRule) {
        // Split compound selectors so each gets its own entry, matching the
        // node `css` package behaviour (it splits on commas).
        const selectors = rule.selectorText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        rules.push({
          type: "rule",
          selectors,
          declarations: extractDeclarations(rule.style),
        });
      } else if (rule instanceof CSSFontFaceRule) {
        rules.push({
          type: "font-face",
          declarations: extractDeclarations(rule.style),
        });
      } else if (rule instanceof CSSMediaRule) {
        const mediaRules: CSSRuleNode[] = [];
        for (let k = 0; k < rule.cssRules.length; k++) {
          const inner = rule.cssRules[k];
          if (inner instanceof CSSStyleRule) {
            const selectors = inner.selectorText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);

            mediaRules.push({
              type: "rule",
              selectors,
              declarations: extractDeclarations(inner.style),
            });
          }
        }

        rules.push({
          type: "media",
          media: rule.conditionText,
          rules: mediaRules,
        });
      }
    }
  }

  document.head.removeChild(style);

  return {
    type: "stylesheet",
    stylesheet: {
      rules,
    },
  };
}

export default {
  parse,
};
