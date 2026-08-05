import type { LayoutNode } from "../../src/dom/node.js";
import { prepareHtmlRender } from "../../src/html-to-pdf/prepare-html-render.js";
import type { RenderBox } from "../../src/pdf/types.js";
import { resolveOutlineStrokes } from "../../src/pdf/utils/outline.js";

function findLayoutNodeById(root: LayoutNode, id: string): LayoutNode {
  let found: LayoutNode | undefined;
  root.walk((node) => {
    if (node.customData?.id === id) {
      found = node;
    }
  });
  if (!found) {
    throw new Error(`Missing layout node ${id}`);
  }
  return found;
}

function findRenderBoxById(root: RenderBox, id: string): RenderBox {
  if (root.customData?.id === id) {
    return root;
  }
  for (const child of root.children) {
    try {
      return findRenderBoxById(child, id);
    } catch {
      // Continue through sibling subtrees.
    }
  }
  throw new Error(`Missing render box ${id}`);
}

describe("CSS outline", () => {
  it("parses shorthand, currentColor and offset without changing layout", async () => {
    const prepared = await prepareHtmlRender({
      html: `<div id="target">Target</div><div id="following">Following</div>`,
      css: `
        @page { size: 300px 300px; margin: 0; }
        html, body, div { margin: 0; padding: 0; }
        #target {
          width: 100px;
          height: 40px;
          color: #336699;
          outline: 4px dashed currentColor;
          outline-offset: 3px;
        }
        #following { height: 20px; }
      `,
      pagedBodyMargin: "zero",
    });

    const target = findLayoutNodeById(prepared.layoutRoot, "target");
    const following = findLayoutNodeById(prepared.layoutRoot, "following");
    const renderBox = findRenderBoxById(prepared.renderTree.root, "target");

    expect(target.style.outlineWidth).toBe(4);
    expect(target.style.outlineStyle).toBe("dashed");
    expect(target.style.outlineColor).toBe("currentColor");
    expect(target.style.outlineOffset).toBe(3);
    expect(following.box.y).toBeCloseTo(target.box.y + 40, 4);
    expect(renderBox.outline).toEqual({
      width: 4,
      style: "dashed",
      color: { r: 0.2, g: 0.4, b: 0.6, a: 1 },
      offset: 3,
    });
  });

  it("lets longhands override a preceding shorthand", async () => {
    const prepared = await prepareHtmlRender({
      html: `<div id="target">Target</div>`,
      css: `
        #target {
          outline: thick dotted red;
          outline-width: 2px;
          outline-style: solid;
          outline-color: blue;
          outline-offset: -1px;
        }
      `,
      pagedBodyMargin: "zero",
    });

    const target = findLayoutNodeById(prepared.layoutRoot, "target");
    const renderBox = findRenderBoxById(prepared.renderTree.root, "target");
    expect(target.style.outlineWidth).toBe(2);
    expect(target.style.outlineStyle).toBe("solid");
    expect(target.style.outlineColor).toBe("blue");
    expect(target.style.outlineOffset).toBe(-1);
    expect(renderBox.outline?.width).toBe(2);
    expect(renderBox.outline?.style).toBe("solid");
  });

  it("suppresses rendering for outline none", async () => {
    const prepared = await prepareHtmlRender({
      html: `<div id="target">Target</div>`,
      css: `#target { outline: 5px solid red; outline: none; }`,
      pagedBodyMargin: "zero",
    });

    expect(findRenderBoxById(prepared.renderTree.root, "target").outline).toBeUndefined();
  });

  it("builds one dashed stroke and two double strokes", () => {
    const rect = { x: 10, y: 20, width: 100, height: 50 };
    const radius = {
      topLeft: { x: 5, y: 5 },
      topRight: { x: 5, y: 5 },
      bottomRight: { x: 5, y: 5 },
      bottomLeft: { x: 5, y: 5 },
    };
    const color = { r: 1, g: 0, b: 0, a: 1 };

    const dashed = resolveOutlineStrokes(rect, radius, {
      width: 4,
      style: "dashed",
      color,
      offset: 2,
    });
    expect(dashed).toHaveLength(1);
    expect(dashed[0].options.lineWidth).toBe(4);
    expect(dashed[0].options.dash?.pattern).toEqual([12, 12]);

    const double = resolveOutlineStrokes(rect, radius, {
      width: 6,
      style: "double",
      color,
      offset: 2,
    });
    expect(double).toHaveLength(2);
    expect(double[0].options.lineWidth).toBeCloseTo(2, 5);
    expect(double[1].options.lineWidth).toBeCloseTo(2, 5);
  });

  it("uses round caps for dotted outlines", () => {
    const strokes = resolveOutlineStrokes(
      { x: 0, y: 0, width: 40, height: 20 },
      {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 0, y: 0 },
        bottomRight: { x: 0, y: 0 },
        bottomLeft: { x: 0, y: 0 },
      },
      {
        width: 3,
        style: "dotted",
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: 0,
      },
    );

    expect(strokes[0].options.lineCap).toBe("round");
    expect(strokes[0].options.dash?.pattern).toEqual([3, 6]);
  });
});
