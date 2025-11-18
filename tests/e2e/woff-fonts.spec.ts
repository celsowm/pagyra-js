import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";
import { renderHtmlToPdf } from "../../src/html-to-pdf.js";

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return arrayBuffer;
}

describe("E2E: WOFF and WOFF2 Font Support", () => {
  it("should render a PDF with WOFF and WOFF2 fonts without errors", async () => {
    const latoRegularWoff = readFileSync(resolve("./tests/assets/fonts/lato-regular.woff"));
    const latoBoldWoff2 = readFileSync(resolve("./tests/assets/fonts/lato-bold.woff2"));

    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: 'Lato';
              src: url('data:font/woff;base64,${latoRegularWoff.toString("base64")}') format('woff');
              font-weight: normal;
            }
            @font-face {
              font-family: 'Lato';
              src: url('data:font/woff2;base64,${latoBoldWoff2.toString("base64")}') format('woff2');
              font-weight: bold;
            }
            body {
              font-family: 'Lato', sans-serif;
            }
          </style>
        </head>
        <body>
          <p>This is regular text.</p>
          <p style="font-weight: bold;">This is bold text.</p>
        </body>
      </html>
    `;

    let pdfBuffer: Uint8Array | null = null;
    try {
      pdfBuffer = await renderHtmlToPdf({
        html,
        fontConfig: {
          fontFaceDefs: [
            { name: "Lato-Regular", family: "Lato", weight: "normal", data: toArrayBuffer(latoRegularWoff) },
            { name: "Lato-Bold", family: "Lato", weight: "bold", data: toArrayBuffer(latoBoldWoff2) },
          ],
        },
        viewportWidth: 800,
        viewportHeight: 600,
        pageWidth: 595,
        pageHeight: 842,
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        css: ''
      });
    } catch (e) {
      // Fail the test explicitly if an error is thrown
      expect(e).toBeNull();
    }

    expect(pdfBuffer).not.toBeNull();
    expect(pdfBuffer).toBeInstanceOf(Uint8Array);
    expect(pdfBuffer!.length).toBeGreaterThan(0);
  });
});
