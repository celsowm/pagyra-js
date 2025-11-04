import { describe, expect, it } from "vitest";
import {
  ComputedStyle,
  Display,
  FloatMode,
  LayoutNode,
  layoutTree,
  Position,
} from "../src/index.js";

describe("layout engine", () => {
  it("wraps inline nodes across multiple lines", () => {
    const root = new LayoutNode(new ComputedStyle());
    const paragraph = new LayoutNode(
      new ComputedStyle({ display: Display.Block }),
    );
    root.appendChild(paragraph);

    const inlineA = new LayoutNode(
      new ComputedStyle({ display: Display.Inline }),
      [],
      { textContent: "A".repeat(12) },
    );
    const inlineB = new LayoutNode(
      new ComputedStyle({ display: Display.Inline }),
      [],
      { textContent: "B".repeat(14) },
    );
    paragraph.appendChild(inlineA);
    paragraph.appendChild(inlineB);

    layoutTree(root, { width: 180, height: 400 });

    expect(paragraph.establishesIFC).toBe(true);
    expect(inlineA.box.y).toBeLessThan(inlineB.box.y);
    expect(Math.round(inlineA.box.x)).toBe(Math.round(inlineB.box.x));
    expect(paragraph.box.contentHeight).toBeGreaterThan(inlineA.box.contentHeight);
  });

  it("layouts text around floats and restores width after float ends", () => {
    const root = new LayoutNode(new ComputedStyle());

    const floatBox = new LayoutNode(
      new ComputedStyle({
        display: Display.Block,
        float: FloatMode.Left,
        width: 120,
        height: 30,
        marginRight: 8,
      }),
    );

    const inlineStyle = () => new ComputedStyle({ display: Display.Inline });
    const inline1 = new LayoutNode(inlineStyle(), [], { textContent: "Flowing text." });
    const inline2 = new LayoutNode(inlineStyle(), [], { textContent: "Another inline chunk." });
    const inline3 = new LayoutNode(inlineStyle(), [], { textContent: "Trailing text after float restores width." });

    root.appendChild(floatBox);
    root.appendChild(inline1);
    root.appendChild(inline2);
    root.appendChild(inline3);

    layoutTree(root, { width: 360, height: 400 });

    expect(floatBox.box.x).toBeGreaterThanOrEqual(0);
    expect(floatBox.box.y).toBe(0);

    expect(inline1.box.x).toBeGreaterThan(floatBox.box.x);
    expect(inline2.box.x).toBeGreaterThanOrEqual(inline1.box.x);
    expect(inline3.box.x).toBeLessThan(inline2.box.x);
    expect(inline3.box.x).toBeLessThan(10);

    const floatBottom = floatBox.box.y + floatBox.box.marginBoxHeight;
    expect(inline3.box.y).toBeGreaterThanOrEqual(floatBottom);
  });

  it("limits block width using max-width", () => {
    const root = new LayoutNode(new ComputedStyle());
    const constrained = new LayoutNode(
      new ComputedStyle({
        display: Display.Block,
        maxWidth: 240,
      }),
    );
    root.appendChild(constrained);

    layoutTree(root, { width: 480, height: 600 });

    expect(constrained.box.contentWidth).toBeLessThanOrEqual(240);
  });

  it("keeps overly wide inline content in flow instead of dropping it", () => {
    const root = new LayoutNode(new ComputedStyle());
    const paragraph = new LayoutNode(
      new ComputedStyle({ display: Display.Block }),
    );
    root.appendChild(paragraph);

    const longText =
      "Need multiple pages? Just let the text flow - Pagyra will handle the pagination.";
    const inline = new LayoutNode(
      new ComputedStyle({ display: Display.Inline }),
      [],
      { textContent: longText },
    );
    paragraph.appendChild(inline);

    layoutTree(root, { width: 200, height: 400 });

    expect(paragraph.establishesIFC).toBe(true);
    expect(paragraph.box.contentHeight).toBeGreaterThan(0);
    expect(inline.box.contentHeight).toBeGreaterThan(0);
    expect(inline.box.y).toBeGreaterThanOrEqual(paragraph.box.y);
  });

  it("positions absolutely positioned elements using inset offsets", () => {
    const root = new LayoutNode(new ComputedStyle());

    const absoluteLeftTop = new LayoutNode(
      new ComputedStyle({
        display: Display.Block,
        position: Position.Absolute,
        width: 120,
        height: 80,
        left: 30,
        top: 40,
      }),
    );

    const absoluteRightBottom = new LayoutNode(
      new ComputedStyle({
        display: Display.Block,
        position: Position.Absolute,
        width: 60,
        height: 40,
        right: 10,
        bottom: 20,
      }),
    );

    root.appendChild(absoluteLeftTop);
    root.appendChild(absoluteRightBottom);

    layoutTree(root, { width: 300, height: 200 });

    expect(absoluteLeftTop.box.x).toBeCloseTo(30);
    expect(absoluteLeftTop.box.y).toBeCloseTo(40);
    expect(absoluteLeftTop.box.contentWidth).toBeCloseTo(120);
    expect(absoluteLeftTop.box.contentHeight).toBeCloseTo(80);

    expect(absoluteRightBottom.box.x).toBeCloseTo(230);
    expect(absoluteRightBottom.box.y).toBeCloseTo(140);
    expect(absoluteRightBottom.box.contentWidth).toBeCloseTo(60);
    expect(absoluteRightBottom.box.contentHeight).toBeCloseTo(40);
  });
});
