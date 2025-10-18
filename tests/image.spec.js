import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderHtmlToPdf, prepareHtmlRender } from "../src/html-to-pdf.js";
describe("Image handling tests", () => {
    const duckImagePath = join(process.cwd(), "tests/assets/images/duck.jpg");
    let duckImageBuffer;
    let duckImageRef;
    beforeAll(() => {
        // Load the duck.jpg image for testing
        duckImageBuffer = readFileSync(duckImagePath);
        // Create an ImageRef object for testing
        // Note: For now, we'll use a placeholder for image data since the actual
        // implementation may not be fully handling image conversion yet
        duckImageRef = {
            src: "tests/assets/images/duck.jpg",
            width: 300, // Example width
            height: 200, // Example height
            format: "jpeg",
            channels: 3,
            bitsPerComponent: 8,
            data: duckImageBuffer.buffer.slice(duckImageBuffer.byteOffset, duckImageBuffer.byteOffset + duckImageBuffer.byteLength)
        };
    });
    it("should load duck.jpg image successfully", () => {
        expect(duckImageBuffer).toBeDefined();
        expect(duckImageBuffer.length).toBeGreaterThan(0);
        expect(duckImageRef).toBeDefined();
        expect(duckImageRef.src).toBe("tests/assets/images/duck.jpg");
        expect(duckImageRef.width).toBe(300);
        expect(duckImageRef.height).toBe(200);
        expect(duckImageRef.data).toBeDefined();
        expect(duckImageRef.data.byteLength).toBeGreaterThan(0);
    });
    it("should create HTML with image element", () => {
        const html = `
      <html>
        <body>
          <img src="${duckImageRef.src}" alt="Test duck image" width="${duckImageRef.width}" height="${duckImageRef.height}">
        </body>
      </html>
    `;
        expect(html).toContain('<img src="tests/assets/images/duck.jpg"');
        expect(html).toContain('width="300"');
        expect(html).toContain('height="200"');
    });
    it("should render HTML with image to layout tree", async () => {
        const html = `
      <html>
        <body>
          <img src="${duckImageRef.src}" alt="Test duck image" width="${duckImageRef.width}" height="${duckImageRef.height}">
        </body>
      </html>
    `;
        const css = "";
        const prepared = await prepareHtmlRender({
            html,
            css,
            viewportWidth: 800,
            viewportHeight: 600,
            pageWidth: 595.28,
            pageHeight: 841.89,
            margins: { top: 36, right: 36, bottom: 36, left: 36 }
        });
        // Check if the render tree was created successfully
        expect(prepared.renderTree).toBeDefined();
        expect(prepared.renderTree.root).toBeDefined();
        expect(prepared.renderTree.root.children).toBeDefined();
        // Note: Current implementation may not convert <img> elements to image nodes yet
        // This test verifies the layout tree is created, but image conversion may be a future feature
        const imageNodes = findImageNodes(prepared.renderTree.root);
        expect(imageNodes.length).toBeGreaterThan(0);
    });
    it("should render PDF with image", async () => {
        const html = `
      <html>
        <body>
          <h1>Image Test</h1>
          <img src="${duckImageRef.src}" alt="Test duck image" width="${duckImageRef.width}" height="${duckImageRef.height}">
          <p>This is a test paragraph with an image.</p>
        </body>
      </html>
    `;
        const css = "body { font-family: Arial, sans-serif; }";
        const pdfBuffer = await renderHtmlToPdf({
            html,
            css,
            viewportWidth: 800,
            viewportHeight: 600,
            pageWidth: 595.28,
            pageHeight: 841.89,
            margins: { top: 36, right: 36, bottom: 36, left: 36 }
        });
        expect(pdfBuffer).toBeDefined();
        expect(pdfBuffer instanceof Uint8Array).toBe(true);
        expect(pdfBuffer.length).toBeGreaterThan(0);
    });
    it("should handle image with different CSS styles", async () => {
        const html = `
      <html>
        <head>
          <style>
            .test-image {
              border: 2px solid red;
              margin: 20px;
              float: left;
            }
          </style>
        </head>
        <body>
          <img src="${duckImageRef.src}" alt="Styled duck image" class="test-image">
          <p>This image should have a red border and be floated left.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
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
            margins: { top: 36, right: 36, bottom: 36, left: 36 }
        });
        expect(pdfBuffer).toBeDefined();
        expect(pdfBuffer.length).toBeGreaterThan(0);
    });
    it("should handle responsive images", async () => {
        const html = `
      <html>
        <body>
          <img src="${duckImageRef.src}" alt="Responsive duck image" style="max-width: 100%; height: auto;">
          <p>This image should be responsive.</p>
        </body>
      </html>
    `;
        const pdfBuffer = await renderHtmlToPdf({
            html,
            css: "",
            viewportWidth: 400,
            viewportHeight: 600,
            pageWidth: 595.28,
            pageHeight: 841.89,
            margins: { top: 36, right: 36, bottom: 36, left: 36 }
        });
        expect(pdfBuffer).toBeDefined();
        expect(pdfBuffer.length).toBeGreaterThan(0);
    });
    it("should handle images in tables", async () => {
        const html = `
      <html>
        <body>
          <table border="1">
            <tr>
              <td><img src="${duckImageRef.src}" alt="Image in table" width="100" height="50"></td>
              <td>Table cell with image</td>
            </tr>
          </table>
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
            margins: { top: 36, right: 36, bottom: 36, left: 36 }
        });
        expect(pdfBuffer).toBeDefined();
        expect(pdfBuffer.length).toBeGreaterThan(0);
    });
    it("should handle multiple images", async () => {
        const html = `
      <html>
        <body>
          <img src="${duckImageRef.src}" alt="First duck" width="150" height="100">
          <img src="${duckImageRef.src}" alt="Second duck" width="150" height="100">
          <img src="${duckImageRef.src}" alt="Third duck" width="150" height="100">
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
            margins: { top: 36, right: 36, bottom: 36, left: 36 }
        });
        expect(pdfBuffer).toBeDefined();
        expect(pdfBuffer.length).toBeGreaterThan(0);
    });
    // Helper function to find image nodes in the render tree
    function findImageNodes(node) {
        const imageNodes = [];
        if (node.image) {
            imageNodes.push(node);
        }
        for (const child of node.children) {
            imageNodes.push(...findImageNodes(child));
        }
        return imageNodes;
    }
});
