import { describe, expect, it, beforeAll } from "vitest";

import { renderHtmlToPdf } from "../src/html-to-pdf.js";
import { ImageService } from "../src/image/image-service.js";

describe("PNG image handling tests", () => {
  let pngImageBuffer: Buffer;

  beforeAll(() => {
    // A simple 1x1 transparent PNG
    const pngData = [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ];
    pngImageBuffer = Buffer.from(pngData);
  });

  it("should decode a PNG image successfully", async () => {
    const imageService = ImageService.getInstance();
    let arrayBuffer = pngImageBuffer.buffer;
    if (arrayBuffer.byteLength !== pngImageBuffer.length) {
      arrayBuffer = arrayBuffer.slice(
        pngImageBuffer.byteOffset,
        pngImageBuffer.byteOffset + pngImageBuffer.length
      );
    }
    const imageInfo = await imageService.decodeImage(arrayBuffer as ArrayBuffer);
    expect(imageInfo).toBeDefined();
    expect(imageInfo.width).toBe(1);
    expect(imageInfo.height).toBe(1);
    expect(imageInfo.format).toBe("png");
  });

  it("should render HTML with PNG image to PDF", async () => {
    const html = `
      <html>
        <body>
          <h1>PNG Image Test</h1>
          <img src="data:image/png;base64,${pngImageBuffer.toString("base64")}" alt="Test PNG image">
        </body>
      </html>
    `;

    const pdfBuffer = await renderHtmlToPdf({
      html,
      css: "",
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 595.28,
      pageHeight: 841.89,
      margins: { top: 36, right: 36, bottom: 36, left: 36 },
    });

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer instanceof Uint8Array).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });
});
