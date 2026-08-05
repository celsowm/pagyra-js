import { ComputedStyle, resolvedLineHeight } from "../../src/css/style.js";
import { computeStyleForElement } from "../../src/css/compute-style.js";
import { makeUnitParsers } from "../../src/units/units.js";
import type { DomElement } from "../../src/types/core.js";

function makeElement(inlineStyle: string): DomElement {
  return {
    nodeType: 1,
    nodeName: "DIV",
    tagName: "div",
    getAttribute(name: string) {
      return name === "style" ? inlineStyle : null;
    },
    hasAttribute(name: string) {
      return name === "style";
    },
    querySelectorAll() {
      return [];
    },
    parentElement: null,
    firstElementChild: null,
    lastElementChild: null,
    nextElementSibling: null,
    previousElementSibling: null,
  };
}

function compute(inlineStyle: string, parent = new ComputedStyle()): ComputedStyle {
  return computeStyleForElement(
    makeElement(inlineStyle),
    [],
    parent,
    makeUnitParsers({ viewport: { width: 800, height: 600 } }),
    16,
  );
}

describe("font shorthand", () => {
  it("parses style, variant, weight, size, line-height and family", () => {
    const style = compute('font: italic small-caps 700 20px/1.5 "Inter", sans-serif;');

    expect(style.fontStyle).toBe("italic");
    expect(style.fontVariant).toBe("small-caps");
    expect(style.fontWeight).toBe(700);
    expect(style.fontSize).toBe(20);
    expect(resolvedLineHeight(style)).toBe(30);
    expect(style.fontFamily).toBe('"Inter", sans-serif');
  });

  it("resets omitted font longhands to their initial values", () => {
    const style = compute(
      "font-style: italic; font-variant: small-caps; font-weight: 900; line-height: 2; font: 18px serif;",
    );

    expect(style.fontStyle).toBe("normal");
    expect(style.fontVariant).toBe("normal");
    expect(style.fontWeight).toBe(400);
    expect(style.lineHeight.kind).toBe("normal");
    expect(style.fontFamily).toBe("serif");
  });

  it("allows a later longhand to override the shorthand", () => {
    const style = compute("font: italic 700 16px serif; font-weight: 300; font-style: normal;");

    expect(style.fontWeight).toBe(300);
    expect(style.fontStyle).toBe("normal");
  });

  it("supports font-size keywords and percentages", () => {
    const parent = new ComputedStyle({ fontSize: 20 });
    const percentage = compute("font: 125% serif;", parent);
    const keyword = compute("font: larger serif;", parent);

    expect(percentage.fontSize).toBe(25);
    expect(keyword.fontSize).toBe(24);
  });

  it("does not partially apply an invalid shorthand", () => {
    const style = compute("font-style: italic; font: condensed 16px serif;");

    expect(style.fontStyle).toBe("italic");
  });
});
