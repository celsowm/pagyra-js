import { describe, expect, it } from "vitest";
import { LayoutNode } from "../src/dom/node.js";
import { ComputedStyle } from "../src/css/style.js";
import { Display } from "../src/css/enums.js";
import { layoutTree } from "../src/layout/pipeline/layout-tree.js";
import { buildRenderTree } from "../src/pdf/layout-tree-builder.js";
import { renderPdf } from "../src/pdf/render.js";

describe("PDF basic rendering", () => {
  it("converts a layout tree into a PDF binary", async () => {
    const root = createSampleLayout();
    layoutTree(root, { width: 320, height: 480 });

    const renderable = buildRenderTree(root);
    const pdfBytes = await renderPdf(renderable);

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    const header = Buffer.from(pdfBytes.subarray(0, 4)).toString("ascii");
    expect(header).toBe("%PDF");
    const trailer = Buffer.from(pdfBytes.subarray(pdfBytes.length - 6)).toString("ascii");
    expect(trailer.trim()).toBe("%%EOF");
  });
});

function createSampleLayout(): LayoutNode {
  const root = new LayoutNode(new ComputedStyle());
  const block = new LayoutNode(new ComputedStyle({ display: Display.Block }));
  const child = new LayoutNode(
    new ComputedStyle({ display: Display.Block, marginTop: 8, marginBottom: 8 }),
  );
  root.appendChild(block);
  block.appendChild(child);
  return root;
}
