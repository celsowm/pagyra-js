import { parseCalcLength } from "../../src/css/parsers/calc-parser.js";
import { computeStyleForElement } from "../../src/css/compute-style.js";
import { ComputedStyle } from "../../src/css/style.js";
import { registerAllPropertyParsers } from "../../src/css/parsers/register-parsers.js";
import { makeUnitParsers } from "../../src/units/units.js";
import type { DomElement } from "../../src/types/core.js";

function makeElement(inlineStyle: string): DomElement {
  return {
    nodeType: 1,
    nodeName: "DIV",
    tagName: "div",
    getAttribute(name: string) {
      if (name === "style") {
        return inlineStyle;
      }
      return null;
    },
    hasAttribute(name: string) {
      return name === "style";
    },
    querySelectorAll(_selectors: string) {
      return [];
    },
    parentElement: null,
    firstElementChild: null,
    lastElementChild: null,
    nextElementSibling: null,
    previousElementSibling: null,
  };
}

describe("calc() parser", () => {
  beforeAll(() => {
    registerAllPropertyParsers();
  });

  it("parses arithmetic with mixed units", () => {
    const parsed = parseCalcLength("calc((10px + 5%) * 2 - 4px / 2)");
    expect(parsed).toBeDefined();
    expect(parsed).toEqual({
      kind: "calc",
      px: 18,
      percent: 0.1,
      em: 0,
      rem: 0,
      cqw: 0,
      cqh: 0,
      cqi: 0,
      cqb: 0,
      cqmin: 0,
      cqmax: 0,
    });
  });

  it("supports calc in width declarations", () => {
    const style = computeStyleForElement(
      makeElement("width: calc(100% - 20px);"),
      [],
      new ComputedStyle(),
      makeUnitParsers({ viewport: { width: 800, height: 600 } }),
      16,
    );
    expect(typeof style.width).toBe("object");
    expect(style.width).toEqual({
      kind: "calc",
      px: -20,
      percent: 1,
      em: 0,
      rem: 0,
      cqw: 0,
      cqh: 0,
      cqi: 0,
      cqb: 0,
      cqmin: 0,
      cqmax: 0,
    });
  });
});
