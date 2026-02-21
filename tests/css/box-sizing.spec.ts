import { registerAllPropertyParsers } from "../../src/css/parsers/register-parsers.js";
import { computeStyleForElement } from "../../src/css/compute-style.js";
import { ComputedStyle } from "../../src/css/style.js";
import { BoxSizing } from "../../src/css/enums.js";
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

describe("box-sizing parser and computed style", () => {
  beforeAll(() => {
    registerAllPropertyParsers();
  });

  it("defaults to content-box", () => {
    const style = computeStyleForElement(
      makeElement("width: 200px;"),
      [],
      new ComputedStyle(),
      makeUnitParsers({ viewport: { width: 800, height: 600 } }),
      16,
    );

    expect(style.boxSizing).toBe(BoxSizing.ContentBox);
  });

  it("parses border-box from inline style", () => {
    const style = computeStyleForElement(
      makeElement("box-sizing: border-box; width: 200px;"),
      [],
      new ComputedStyle(),
      makeUnitParsers({ viewport: { width: 800, height: 600 } }),
      16,
    );

    expect(style.boxSizing).toBe(BoxSizing.BorderBox);
  });

  it("parses content-box explicitly", () => {
    const style = computeStyleForElement(
      makeElement("box-sizing: content-box;"),
      [],
      new ComputedStyle(),
      makeUnitParsers({ viewport: { width: 800, height: 600 } }),
      16,
    );

    expect(style.boxSizing).toBe(BoxSizing.ContentBox);
  });
});

