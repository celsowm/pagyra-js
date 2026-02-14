/**
 * Browser shim for css - provides CSS parsing using browser APIs
 * This replaces the Node.js css package in browser builds
 */

interface CSSRule {
  type: number;
  selectors?: string[];
  declarations?: Array<{ property: string; value: string }>;
  rules?: CSSRule[];
  media?: string;
}

interface CSSParseResult {
  type: string;
  stylesheet?: {
    rules: CSSRule[];
  };
}

/**
 * Parse CSS text into an AST-like structure
 * Compatible with the Node.js css package's parse() function
 */
export function parse(cssText: string): CSSParseResult {
  const style = document.createElement('style');
  style.textContent = cssText;
  document.head.appendChild(style);
  
  const sheet = style.sheet;
  const rules: CSSRule[] = [];
  
  if (sheet) {
    const cssRules = sheet.cssRules || [];
    for (let i = 0; i < cssRules.length; i++) {
      const rule = cssRules[i];
      if (rule.type === CSSRule.STYLE_RULE) {
        const styleRule = rule as CSSStyleRule;
        const declarations: Array<{ property: string; value: string }> = [];
        
        const styleObj = styleRule.style;
        for (let j = 0; j < styleObj.length; j++) {
          const prop = styleObj[j];
          declarations.push({
            property: prop,
            value: styleObj.getPropertyValue(prop)
          });
        }
        
        rules.push({
          type: styleRule.type,
          selectors: [styleRule.selectorText],
          declarations
        });
      } else if (rule.type === CSSRule.MEDIA_RULE) {
        const mediaRule = rule as CSSMediaRule;
        const mediaRules: CSSRule[] = [];
        
        for (let k = 0; k < mediaRule.cssRules.length; k++) {
          const mediaStyleRule = mediaRule.cssRules[k] as CSSStyleRule;
          if (mediaStyleRule.type === CSSRule.STYLE_RULE) {
            const declarations: Array<{ property: string; value: string }> = [];
            const styleObj = mediaStyleRule.style;
            for (let j = 0; j < styleObj.length; j++) {
              const prop = styleObj[j];
              declarations.push({
                property: prop,
                value: styleObj.getPropertyValue(prop)
              });
            }
            mediaRules.push({
              type: mediaStyleRule.type,
              selectors: [mediaStyleRule.selectorText],
              declarations
            });
          }
        }
        
        rules.push({
          type: rule.type,
          media: (rule as CSSMediaRule).conditionText,
          rules: mediaRules
        });
      }
    }
  }
  
  document.head.removeChild(style);
  
  return {
    type: 'stylesheet',
    stylesheet: {
      rules
    }
  };
}

export default {
  parse
};
