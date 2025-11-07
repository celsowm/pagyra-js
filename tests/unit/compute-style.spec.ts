import { describe, expect, it } from "vitest";
import { computeStyleForElement } from "../../src/css/compute-style.js";
import { ComputedStyle } from "../../src/css/style.js";
import { createNormalLineHeight } from "../../src/css/line-height.js";
import { makeUnitParsers } from "../../src/units/units.js";
import type { CssRuleEntry, DomEl } from "../../src/html/css/parse-css.js";

const units = makeUnitParsers({ viewport: { width: 800, height: 600 } });

function makeElement(tagName: string, styleAttr?: string): DomEl {
  return {
    tagName,
    getAttribute(name: string) {
      if (name === "style") {
        return styleAttr ?? null;
      }
      return null;
    },
  };
}

function makeParentStyle(fontSize: number): ComputedStyle {
  return new ComputedStyle({
    fontSize,
    lineHeight: createNormalLineHeight(),
  });
}

describe("computeStyleForElement font-size adjustments", () => {
  it("scales down <small> relative to its parent when no explicit font-size is provided", () => {
    const parentStyle = makeParentStyle(12);
    const style = computeStyleForElement(makeElement("small"), [], parentStyle, units, 12);
    expect(style.fontSize).toBeCloseTo(9.6, 5);
  });

  it("does not override explicit font-size declarations on <small>", () => {
    const parentStyle = makeParentStyle(12);
    const cssRules: CssRuleEntry[] = [
      {
        selector: "small",
        declarations: { "font-size": "14px" },
        match: () => true,
      },
    ];
    const style = computeStyleForElement(makeElement("small"), cssRules, parentStyle, units, 12);
    expect(style.fontSize).toBeCloseTo(14, 5);
  });
});
