import { describe, expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { LayoutNode } from "../src/dom/node.js";
import { ComputedStyle } from "../src/css/style.js";
import { Display } from "../src/css/enums.js";
import { layoutTree } from "../src/layout/pipeline/layout-tree.js";
import { buildRenderTree } from "../src/pdf/layout-tree-builder.js";
import { renderPdf } from "../src/pdf/render.js";

describe("PDF text and fonts", () => {
  it("renders inline text content as text operators", async () => {
    const root = new LayoutNode(new ComputedStyle());
    const paragraph = new LayoutNode(new ComputedStyle({ display: Display.Block, marginTop: 8, marginBottom: 8 }));
    const text = new LayoutNode(
      new ComputedStyle({ display: Display.Inline, color: "#111111", fontSize: 14, fontFamily: "Courier New" }),
      [],
      { textContent: "Hello inline world" },
    );
    paragraph.appendChild(text);
    root.appendChild(paragraph);

    layoutTree(root, { width: 240, height: 320 });
    const renderable = buildRenderTree(root);
    const pdfBytes = await renderPdf(renderable);

    const parser = new PDFParse({ data: Buffer.from(pdfBytes) });
    const result = await parser.getText();
    expect(result.text).toContain("Hello inline world");
  });

  it.each([
    ["TTF", "DejaVu Sans", "assets/fonts/ttf/dejavu/DejaVuSans.ttf"],
  ])("embeds and renders text with %s fonts", async (format, family, path) => {
    const root = new LayoutNode(new ComputedStyle());
    const paragraph = new LayoutNode(new ComputedStyle({ display: Display.Block }));
    const text = new LayoutNode(
      new ComputedStyle({ display: Display.Inline, fontSize: 12, fontFamily: family }),
      [],
      { textContent: `Hello ${format} world` },
    );
    paragraph.appendChild(text);
    root.appendChild(paragraph);

    layoutTree(root, { width: 500, height: 500 });
    const renderable = buildRenderTree(root, {
      stylesheets: {
        fontFaces: [{ family, src: [`url(${path})`] }],
      },
    });
    const pdfBytes = await renderPdf(renderable);

    const parser = new PDFParse({ data: Buffer.from(pdfBytes) });
    const result = await parser.getText();
    expect(result.text).toContain(`Hello ${format} world`);
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
