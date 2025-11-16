import { describe, it, expect } from "vitest";
import { LayoutNode } from "../../src/dom/node.js";
import { ComputedStyle } from "../../src/css/style.js";
import { buildNodeTextRuns } from "../../src/pdf/utils/node-text-run-factory.js";

const BORDER_BOX = { x: 0, y: 0, width: 100, height: 40 };
const CONTENT_BOX = { x: 10, y: 10, width: 80, height: 20 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };

describe("node-text-run-factory", () => {
  it("injects list markers for <li> nodes", () => {
    const style = new ComputedStyle({ fontSize: 12, listStyleType: "decimal" });
    const node = new LayoutNode(style, [], { tagName: "li", textContent: "Hello" });
    node.box.contentWidth = 80;
    node.box.contentHeight = 20;
    node.box.baseline = 14;

    const runs = buildNodeTextRuns({
      node,
      children: [],
      borderBox: BORDER_BOX,
      contentBox: CONTENT_BOX,
      textColor: BLACK,
      decorations: undefined,
      transform: undefined,
      fallbackColor: BLACK,
    });

    expect(runs[0]?.text).toBe("1.");
    expect(runs).toHaveLength(2); // marker + text
  });

  it("applies transforms to text matrices", () => {
    const style = new ComputedStyle({ fontSize: 14 });
    const node = new LayoutNode(style, [], { tagName: "span", textContent: "World" });
    node.box.contentWidth = 60;
    node.box.contentHeight = 20;
    node.box.baseline = 18;

    const baseRuns = buildNodeTextRuns({
      node,
      children: [],
      borderBox: BORDER_BOX,
      contentBox: CONTENT_BOX,
      textColor: BLACK,
      decorations: undefined,
      transform: undefined,
      fallbackColor: BLACK,
    });

    const transformedRuns = buildNodeTextRuns({
      node,
      children: [],
      borderBox: BORDER_BOX,
      contentBox: CONTENT_BOX,
      textColor: BLACK,
      decorations: undefined,
      transform: { a: 1, b: 0, c: 0.2, d: 1, e: 5, f: 5 },
      fallbackColor: BLACK,
    });

    expect(transformedRuns[0].lineMatrix.e).not.toBe(baseRuns[0].lineMatrix.e);
    expect(transformedRuns[0].lineMatrix.f).not.toBe(baseRuns[0].lineMatrix.f);
  });
});
