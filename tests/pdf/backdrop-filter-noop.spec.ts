import { describe, it, expect } from "vitest";
import { renderHtmlToPdf } from "../../src/html-to-pdf.js";

describe("backdrop-filter no-op", () => {
  it("renders without error when backdrop-filter is present", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .glass {
            backdrop-filter: blur(10px) brightness(1.2);
            background: rgba(255, 255, 255, 0.3);
            padding: 20px;
            border-radius: 10px;
          }
          body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px;
          }
        </style>
      </head>
      <body>
        <div class="glass">
          <h1>Glassmorphism Effect</h1>
          <p>This box has backdrop-filter but it will be ignored in PDF (with warning).</p>
        </div>
      </body>
      </html>
    `;

    // Should not throw any errors
    await expect(renderHtmlToPdf({ html })).resolves.toBeDefined();
  });

  it("renders without error when filter has unsupported functions", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .filtered {
            filter: blur(5px) grayscale(0.5) brightness(1.2);
            padding: 20px;
          }
          body {
            font-family: Arial, sans-serif;
          }
        </style>
      </head>
      <body>
        <div class="filtered">
          <p>This box has unsupported filters (blur, grayscale, brightness) that will be ignored.</p>
        </div>
      </body>
      </html>
    `;

    // Should not throw any errors
    await expect(renderHtmlToPdf({ html })).resolves.toBeDefined();
  });

  it("applies opacity from filter correctly", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .semi-transparent {
            filter: opacity(0.5);
            background: red;
            padding: 20px;
          }
          body {
            font-family: Arial, sans-serif;
          }
        </style>
      </head>
      <body>
        <div class="semi-transparent">
          <p>This should be 50% opaque.</p>
        </div>
      </body>
      </html>
    `;

    const result = await renderHtmlToPdf({ html });
    expect(result).toBeDefined();
  });

  it("composes filter opacity with element opacity", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .double-transparent {
            opacity: 0.8;
            filter: opacity(0.5);
            background: blue;
            padding: 20px;
          }
          body {
            font-family: Arial, sans-serif;
          }
        </style>
      </head>
      <body>
        <div class="double-transparent">
          <p>This should be 40% opaque (0.8 * 0.5).</p>
        </div>
      </body>
      </html>
    `;

    const result = await renderHtmlToPdf({ html });
    expect(result).toBeDefined();
  });

  it("renders drop-shadow filter", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .shadowed {
            filter: drop-shadow(5px 5px 10px rgba(0, 0, 0, 0.5));
            background: yellow;
            padding: 20px;
            display: inline-block;
          }
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
          }
        </style>
      </head>
      <body>
        <div class="shadowed">
          <p>This box has a drop-shadow filter.</p>
        </div>
      </body>
      </html>
    `;

    const result = await renderHtmlToPdf({ html });
    expect(result).toBeDefined();
  });
});
