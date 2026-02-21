import { describe, expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { renderHtmlToPdf } from "../../src/html-to-pdf.js";

describe("system-ui fallback subset regression", () => {
  it("keeps text readable when fallback font differs from initial stack resolution", async () => {
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <style>
          :root { --body-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
          body { font-family: var(--body-font); margin: 0; }
          .title { font-weight: 700; font-size: 14pt; }
        </style>
      </head>
      <body>
        <div class="title">HTML→PDF Stress</div>
        <div>Fluxo puro • sem JS • sem fixed/sticky</div>
      </body>
      </html>
    `;

    const pdfBytes = await renderHtmlToPdf({
      html,
      pageWidth: 794,
      pageHeight: 1123,
      viewportWidth: 794,
      viewportHeight: 1123,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const parser = new PDFParse({ data: Buffer.from(pdfBytes) });
    const extracted = await parser.getText();
    await parser.destroy();

    const compact = extracted.text.replace(/\s+/g, " ").trim();
    expect(compact).toContain("HTML→PDF");
    expect(compact.toLowerCase()).toContain("stress");
    expect(compact).not.toContain("GSLK");
  });
});
