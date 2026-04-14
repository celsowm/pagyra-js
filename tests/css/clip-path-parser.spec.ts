import { registerAllPropertyParsers } from "../../src/css/parsers/register-parsers.js";
import { parseClipPath } from "../../src/css/parsers/clip-path-parser.js";
import type { StyleAccumulator } from "../../src/css/style.js";
import { computeStyleForElement } from "../../src/css/compute-style.js";
import { ComputedStyle } from "../../src/css/style.js";
import { makeUnitParsers } from "../../src/units/units.js";
import type { DomElement } from "../../src/types/core.js";

describe("clip-path parser", () => {
  beforeAll(() => {
    registerAllPropertyParsers();
  });

  it("parses polygon clip-path with percentages", () => {
    const target: StyleAccumulator = {};
    parseClipPath("polygon(50% 0, 0 100%, 100% 100%)", target);

    expect(target.clipPath).toBeDefined();
    expect(target.clipPath?.type).toBe("polygon");
    const clip = target.clipPath!;
    expect(clip.type).toBe("polygon");
    if (clip.type !== "polygon") return;
    expect(clip.points).toBeDefined();
    expect(clip.points.length).toBe(3);
    expect(clip.points[0].x.unit).toBe("percent");
    expect(clip.points[1].y.unit).toBe("percent");
  });

  it("parses polygon clip-path with px units", () => {
    const target: StyleAccumulator = {};
    parseClipPath("polygon(0px 0px, 100px 0px, 0px 100px)", target);

    expect(target.clipPath).toBeDefined();
    if (target.clipPath?.type !== "polygon") return;
    expect(target.clipPath.points[2].y.unit).toBe("px");
    expect(target.clipPath.points[2].y.value).toBe(100);
  });

  it("ignores unsupported clip-path values", () => {
    const target: StyleAccumulator = {};
    parseClipPath("circle(50%)", target);

    expect(target.clipPath).toBeUndefined();
  });

  it("propagates clip-path through computeStyleForElement", () => {
    const element: DomElement = {
      nodeType: 1,
      nodeName: "DIV",
      tagName: "div",
      getAttribute(name: string) {
        if (name === "style") {
          return "clip-path: polygon(50% 0, 0 100%, 100% 100%);";
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

    const style = computeStyleForElement(
      element,
      [],
      new ComputedStyle(),
      makeUnitParsers({ viewport: { width: 800, height: 600 } }),
      16,
    );

    expect(style.clipPath).toBeDefined();
    expect(style.clipPath?.type).toBe("polygon");
    if (style.clipPath?.type !== "polygon") return;
    expect(style.clipPath.points).toHaveLength(3);
  });
});
