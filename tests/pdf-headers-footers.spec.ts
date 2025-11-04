import { describe, expect, it } from "vitest";
import { LayoutNode } from "../src/dom/node.js";
import { ComputedStyle } from "../src/css/style.js";
import { Display } from "../src/css/enums.js";
import { layoutTree } from "../src/layout/pipeline/layout-tree.js";
import { buildRenderTree } from "../src/pdf/layout-tree-builder.js";
import { renderPdf } from "../src/pdf/render.js";

describe("PDF headers and footers", () => {
  it("evaluates header placeholders when rendering", async () => {
    const root = createSampleLayout();
    layoutTree(root, { width: 320, height: 480 });

    const renderable = buildRenderTree(root, {
      headerFooter: { headerHtml: "Page {page} of {pages}", maxHeaderHeightPx: 32 },
    });
    const pdfBytes = await renderPdf(renderable);
    const content = Buffer.from(pdfBytes).toString("ascii");
    expect(content).toContain("(Page 1 of 1)");
  });

  it("supports header/footer HTML via renderHtmlToPdf options", async () => {
    const { renderHtmlToPdf } = await import("../src/html-to-pdf.js");
    const pdfBytes = await renderHtmlToPdf({
      html: "<html><body><p>Hello body</p></body></html>",
      css: "",
      viewportWidth: 300,
      viewportHeight: 200,
      pageWidth: 300,
      pageHeight: 200,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      headerFooter: {
        headerHtml: "Header {page}/{pages}",
        footerHtml: "Footer {page}/{pages}",
        maxHeaderHeightPx: 32,
        maxFooterHeightPx: 32,
      },
    });
    const content = Buffer.from(pdfBytes).toString("ascii");
    expect(content).toContain("(Header 1/1)");
    expect(content).toContain("(Footer 1/1)");
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
