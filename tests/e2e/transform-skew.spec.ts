import { test, expect } from "vitest";
import { renderHtmlToPdf } from "../../src/html-to-pdf.js";

test("skewX transform on text emits PAGYRA_TRANSFORM marker in PDF", async () => {
  const html = `<div style="font-size:32px; transform: skewX(20deg);">Skewed text</div>`;
  const css = "";
  const pdf = await renderHtmlToPdf({
    html,
    css,
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const buf = Buffer.from(pdf);
  const marker = Buffer.from("%PAGYRA_TRANSFORM");
  const found = buf.includes(marker);
  expect(found).toBe(true);
});
