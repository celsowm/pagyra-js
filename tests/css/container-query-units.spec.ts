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

describe("container query length units", () => {
  beforeAll(() => {
    registerAllPropertyParsers();
  });

  it("parses cqw/cqh in normal lengths", () => {
    const style = computeStyleForElement(
      makeElement("width:50cqw;height:25cqh;"),
      [],
      new ComputedStyle(),
      makeUnitParsers({ viewport: { width: 800, height: 600 } }),
      16,
    );

    expect(style.width).toMatchObject({
      kind: "calc",
      px: 0,
      percent: 0,
      cqw: 0.5,
    });
    expect(style.height).toMatchObject({
      kind: "calc",
      px: 0,
      percent: 0,
      cqh: 0.25,
    });
  });

  it("parses cq units inside calc()", () => {
    const style = computeStyleForElement(
      makeElement("width:calc(10px + 10cqw - 2cqh + 1cqmin);"),
      [],
      new ComputedStyle(),
      makeUnitParsers({ viewport: { width: 800, height: 600 } }),
      16,
    );

    expect(style.width).toEqual({
      kind: "calc",
      px: 10,
      percent: 0,
      em: 0,
      rem: 0,
      cqw: 0.1,
      cqh: -0.02,
      cqi: 0,
      cqb: 0,
      cqmin: 0.01,
      cqmax: 0,
    });
  });
});
