import { describe, expect, it } from "vitest";
import { LayoutNode } from "../src/dom/node.js";
import { ComputedStyle } from "../src/css/style.js";
import { Display } from "../src/css/enums.js";
import { layoutTree } from "../src/layout/pipeline/layout-tree.js";
import { buildRenderTree } from "../src/pdf/layout-tree-builder.js";
import { renderPdf } from "../src/pdf/render.js";
import { extractPdfContent } from "./helpers/pdf.js";

describe("PDF styling", () => {
  it("applies CSS from <style> tags in HTML", async () => {
    // Minimal HTML with a <style> tag and a styled div
    const html = `
      <html><head><style>
        .red { color: #ff0000; font-size: 18px; }
      </style></head>
      <body><div class="red">Styled Text</div></body></html>
    `;
    // Use the html-to-pdf API directly
    const { renderHtmlToPdf } = await import("../src/html-to-pdf.js");
    const pdfBytes = await renderHtmlToPdf({
      html,
      css: "", // No extra CSS
      viewportWidth: 300,
      viewportHeight: 200,
      pageWidth: 300,
      pageHeight: 200,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const pdfBuffer = Buffer.from(pdfBytes);
    const content = extractPdfContent(pdfBuffer);
    // Check for the text (either literal or hex encoded) and a color operator for red (1 0 0 rg)
    expect(content).toMatch(/Styled\s+Text|<[^>]*53[^>]*74[^>]*79[^>]*6c[^>]*65[^>]*64[^>]*20[^>]*54[^>]*65[^>]*78[^>]*74[^>]*>/i);
    expect(pdfBuffer.toString("latin1")).toMatch(/1\s+0\s+0\s+rg/); // PDF color operator for red
  });

  it("paints backgrounds and borders based on computed style", async () => {
    const root = new LayoutNode(new ComputedStyle());
    const block = new LayoutNode(
      new ComputedStyle({
        display: Display.Block,
        paddingTop: 8,
        paddingRight: 8,
        paddingBottom: 8,
        paddingLeft: 8,
        borderTop: 4,
        borderRight: 4,
        borderBottom: 4,
        borderLeft: 4,
        backgroundLayers: [{ kind: "color", color: "#336699" }],
        borderColor: "#000000",
      }),
    );
    root.appendChild(block);

    layoutTree(root, { width: 200, height: 200 });
    const renderable = buildRenderTree(root);
    const pdfBytes = await renderPdf(renderable);
    const content = Buffer.from(pdfBytes).toString("ascii");

    expect(content).toMatch(/0\.2 0\.4 0\.6 rg\s+[0-9\.\-]+\s+[0-9\.\-]+\s+[0-9\.\-]+\s+[0-9\.\-]+\s+re\s+f/);
    expect(content).toMatch(/0 0 0 rg\s+q\s+[0-9\.\-\s]+cm[\s\S]+f\*\s+Q/);
  });
});
