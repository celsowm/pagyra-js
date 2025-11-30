import { describe, expect, it } from "vitest";
import { paintBoxAtomic } from "../../src/pdf/renderer/box-painter.js";
import { PagePainter } from "../../src/pdf/page-painter.js";
import { PdfDocument } from "../../src/pdf/primitives/pdf-document.js";
import { FontRegistry } from "../../src/pdf/font/font-registry.js";
import { NodeKind, Overflow, type RenderBox, type Radius, type Rect } from "../../src/pdf/types.js";
import { renderTreeForHtml } from "../helpers/render-utils.js";

function zeroRadius(): Radius {
  return {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 0, y: 0 },
    bottomRight: { x: 0, y: 0 },
    bottomLeft: { x: 0, y: 0 },
  };
}

describe("clip-path rendering", () => {
  it("emits clipping commands when a clip-path is present", async () => {
    const doc = new PdfDocument({});
    const fontRegistry = new FontRegistry(doc, { fontFaces: [] });
    const painter = new PagePainter(800, (v) => v, fontRegistry, 0);

    const rect: Rect = { x: 0, y: 0, width: 200, height: 200 };
    const box: RenderBox = {
      id: "node-clip",
      tagName: "div",
      kind: NodeKind.Container,
      contentBox: rect,
      paddingBox: rect,
      borderBox: rect,
      visualOverflow: rect,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      border: { top: 0, right: 0, bottom: 0, left: 0 },
      borderRadius: zeroRadius(),
      clipPath: {
        type: "polygon",
        points: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
          { x: 0, y: 200 },
        ],
      },
      background: { color: { r: 0.2, g: 0.6, b: 0.9, a: 1 } },
      opacity: 1,
      overflow: Overflow.Visible,
      textRuns: [],
      decorations: {},
      textShadows: [],
      boxShadows: [],
      establishesStackingContext: false,
      zIndexComputed: 0,
      positioning: { type: "normal" },
      children: [],
      links: [],
    };

    await paintBoxAtomic(painter, box);
    const result = painter.result();
    const content = result.content;

    expect(content).toContain("W n");
    expect(content).toContain("Q");
  });

  it("resolves polygon clip-path points relative to border-box", async () => {
    const html = `<div style="
      width:200px;height:200px;
      background:skyblue;
      clip-path: polygon(50% 0, 0 100%, 100% 100%);
    "></div>`;

    const renderTree = await renderTreeForHtml(html);
    const body = renderTree.root.children.find((c) => c.tagName === "body") ?? renderTree.root;
    const div = body.children.find((c) => c.tagName === "div");
    expect(div).toBeDefined();
    const clipPath = div!.clipPath;
    expect(clipPath).toBeDefined();
    expect(clipPath?.type).toBe("polygon");
    const points = clipPath!.points;
    expect(points).toHaveLength(3);
    const [a, b, c] = points;
    // Apex centered at top edge
    expect(a.x).toBeCloseTo(div!.borderBox.x + div!.borderBox.width / 2, 5);
    expect(a.y).toBeCloseTo(div!.borderBox.y, 5);
    // Base spans full width at bottom
    expect(b.x).toBeCloseTo(div!.borderBox.x, 5);
    expect(b.y).toBeCloseTo(div!.borderBox.y + div!.borderBox.height, 5);
    expect(c.x).toBeCloseTo(div!.borderBox.x + div!.borderBox.width, 5);
    expect(c.y).toBeCloseTo(div!.borderBox.y + div!.borderBox.height, 5);
  });
});
