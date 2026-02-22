import { registerAllPropertyParsers } from "../../src/css/parsers/register-parsers.js";
import { computeStyleForElement } from "../../src/css/compute-style.js";
import { ComputedStyle } from "../../src/css/style.js";
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

describe("flex shorthand parsing", () => {
  beforeAll(() => {
    registerAllPropertyParsers();
  });

  it("parses flex: 1 1 200px", () => {
    const style = computeStyleForElement(
      makeElement("display:flex;flex:1 1 200px;"),
      [],
      new ComputedStyle(),
      makeUnitParsers({ viewport: { width: 800, height: 600 } }),
      16,
    );

    expect(style.flexGrow).toBe(1);
    expect(style.flexShrink).toBe(1);
    expect(style.flexBasis).toBe(200);
  });

  it("parses single-value numeric flex shorthand", () => {
    const style = computeStyleForElement(
      makeElement("display:flex;flex:2;"),
      [],
      new ComputedStyle(),
      makeUnitParsers({ viewport: { width: 800, height: 600 } }),
      16,
    );

    expect(style.flexGrow).toBe(2);
    expect(style.flexShrink).toBe(1);
    expect(style.flexBasis).toBe(0);
  });
});
