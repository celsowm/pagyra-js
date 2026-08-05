import { computeStyleForElement } from "../../src/css/compute-style.js";
import { WhiteSpace } from "../../src/css/enums.js";
import { registerWhiteSpaceParser } from "../../src/css/parsers/white-space-parser.js";
import { ComputedStyle } from "../../src/css/style.js";
import { makeUnitParsers } from "../../src/units/units.js";
import type { DomElement } from "../../src/types/core.js";

function makeElement(inlineStyle: string, tagName = "div"): DomElement {
  return {
    nodeType: 1,
    nodeName: tagName.toUpperCase(),
    tagName,
    getAttribute(name: string) {
      return name === "style" ? inlineStyle : null;
    },
    hasAttribute(name: string) {
      return name === "style" && inlineStyle.length > 0;
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

const units = makeUnitParsers({ viewport: { width: 800, height: 600 } });

describe("white-space parser and computed style", () => {
  beforeAll(() => {
    registerWhiteSpaceParser();
  });

  it.each([
    ["normal", WhiteSpace.Normal],
    ["nowrap", WhiteSpace.NoWrap],
    ["pre", WhiteSpace.Pre],
    ["pre-wrap", WhiteSpace.PreWrap],
    ["pre-line", WhiteSpace.PreLine],
  ])("parses %s", (value, expected) => {
    const style = computeStyleForElement(
      makeElement(`white-space: ${value}`),
      [],
      new ComputedStyle(),
      units,
      16,
    );

    expect(style.whiteSpace).toBe(expected);
  });

  it("inherits white-space from the parent", () => {
    const style = computeStyleForElement(
      makeElement(""),
      [],
      new ComputedStyle({ whiteSpace: WhiteSpace.PreWrap }),
      units,
      16,
    );

    expect(style.whiteSpace).toBe(WhiteSpace.PreWrap);
  });

  it("allows an explicit child value to override inheritance", () => {
    const style = computeStyleForElement(
      makeElement("white-space: normal"),
      [],
      new ComputedStyle({ whiteSpace: WhiteSpace.Pre }),
      units,
      16,
    );

    expect(style.whiteSpace).toBe(WhiteSpace.Normal);
  });

  it("retains the pre user-agent default", () => {
    const style = computeStyleForElement(
      makeElement("", "pre"),
      [],
      new ComputedStyle({ whiteSpace: WhiteSpace.Normal }),
      units,
      16,
    );

    expect(style.whiteSpace).toBe(WhiteSpace.Pre);
  });

  it("ignores invalid values and inherits instead", () => {
    const style = computeStyleForElement(
      makeElement("white-space: invalid-value"),
      [],
      new ComputedStyle({ whiteSpace: WhiteSpace.NoWrap }),
      units,
      16,
    );

    expect(style.whiteSpace).toBe(WhiteSpace.NoWrap);
  });
});
