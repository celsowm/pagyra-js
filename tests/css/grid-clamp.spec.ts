import { registerAllPropertyParsers } from "../../src/css/parsers/register-parsers.js";
import { parseGap, parseGridTemplate } from "../../src/css/parsers/grid-parser.js";
import { setViewportSize } from "../../src/css/viewport.js";
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

describe("grid clamp parsing and resolution", () => {
  beforeAll(() => {
    registerAllPropertyParsers();
  });

  beforeEach(() => {
    setViewportSize(800, 600);
  });

  it("parses clamp() track sizes in grid-template-columns", () => {
    const parsed = parseGridTemplate("clamp(150px, 20vw, 300px) 1fr");
    expect(parsed).toBeDefined();
    expect(parsed).toHaveLength(2);

    const first = parsed?.[0];
    const second = parsed?.[1];

    expect(first).toEqual({
      kind: "clamp",
      min: 150,
      preferred: 160,
      max: 300,
    });
    expect(second).toEqual({
      kind: "flex",
      flex: 1,
    });
  });

  it("parses clamp() values in gap shorthand", () => {
    const parsed = parseGap("clamp(10px, 5vw, 40px)");
    expect(parsed).toBeDefined();
    expect(parsed?.row).toEqual({
      kind: "clamp",
      min: 10,
      preferred: 40,
      max: 40,
    });
    expect(parsed?.column).toEqual({
      kind: "clamp",
      min: 10,
      preferred: 40,
      max: 40,
    });
  });

  it("resolves clamp() gap values and preserves clamp tracks in computed style", () => {
    const style = computeStyleForElement(
      makeElement("display:grid;grid-template-columns:clamp(150px,20vw,300px) 1fr;gap:clamp(10px,5vw,40px);"),
      [],
      new ComputedStyle(),
      makeUnitParsers({ viewport: { width: 800, height: 600 } }),
      16,
    );

    expect(style.rowGap).toBeCloseTo(40, 3);
    expect(style.columnGap).toBeCloseTo(40, 3);
    expect(style.trackListColumns[0]).toEqual({
      kind: "clamp",
      min: 150,
      preferred: 160,
      max: 300,
    });
  });
});
