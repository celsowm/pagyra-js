import { describe, expect, it } from "vitest";
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
    const content = Buffer.from(pdfBytes).toString("ascii");

    expect(content).toContain("(Hello inline world)");
    expect(content).toMatch(/\/F\d+\s+10\.5\b/);
  });

  it("selects base fonts from CSS font-face local sources", async () => {
    const root = createSampleLayout();
    layoutTree(root, { width: 320, height: 480 });

    const renderable = buildRenderTree(root, {
      headerFooter: { headerHtml: "Hello world", maxHeaderHeightPx: 24, fontFamily: "Times New Roman" },
      stylesheets: {
        fontFaces: [
          {
            family: "Times New Roman",
            src: ['local("Times New Roman")'],
          },
        ],
      },
    });
    const pdfBytes = await renderPdf(renderable);
    const content = Buffer.from(pdfBytes).toString("ascii");
    expect(content).toContain("/BaseFont /Times-Roman");
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
