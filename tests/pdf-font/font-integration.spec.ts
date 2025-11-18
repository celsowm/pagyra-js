import { describe, expect, it, beforeEach } from "vitest";
import { PDFParse } from "pdf-parse";
import { readFileSync } from "fs";
import { join } from "path";
import { LayoutNode } from "../../src/dom/node.js";
import { ComputedStyle } from "../../src/css/style.js";
import { Display } from "../../src/css/enums.js";
import { layoutTree } from "../../src/layout/pipeline/layout-tree.js";
import { buildRenderTree } from "../../src/pdf/layout-tree-builder.js";
import { renderPdf } from "../../src/pdf/render.js";
import { FontOrchestrator } from "../../src/fonts/orchestrator.js";

describe("WOFF/WOFF2 Font Integration Tests", () => {
  let orchestrator: FontOrchestrator;

  beforeEach(() => {
    orchestrator = new FontOrchestrator();
  });

  describe("WOFF Font Rendering", () => {
    it("should render text with WOFF font in PDF", async () => {
      const latoNormalPath = join(process.cwd(), "assets/fonts/woff/lato/lato-latin-400-normal.woff");
      const fontData = readFileSync(latoNormalPath);
      
      // Test WOFF parsing through orchestrator
      const unified = await orchestrator.parseFont(fontData);
      expect(unified).toBeDefined();
      expect(unified.metrics).toBeDefined();

      // Create a simple layout with WOFF font
      const root = new LayoutNode(new ComputedStyle());
      const paragraph = new LayoutNode(new ComputedStyle({ display: Display.Block }));
      const text = new LayoutNode(
        new ComputedStyle({ 
          display: Display.Inline, 
          fontSize: 12, 
          fontFamily: "Lato",
          fontWeight: 400,
          fontStyle: "normal"
        }),
        [],
        { textContent: "Hello WOFF world" },
      );
      paragraph.appendChild(text);
      root.appendChild(paragraph);

      layoutTree(root, { width: 500, height: 500 });
      const renderable = buildRenderTree(root, {
        stylesheets: {
          fontFaces: [{ 
            family: "Lato", 
            src: [`url(${latoNormalPath})`]
          }],
        },
      });
      const pdfBytes = await renderPdf(renderable);

      const parser = new PDFParse({ data: Buffer.from(pdfBytes) });
      const result = await parser.getText();
      expect(result.text).toContain("Hello WOFF world");
    });

    it("should handle italic WOFF font variant", async () => {
      const latoItalicPath = join(process.cwd(), "assets/fonts/woff/lato/lato-latin-400-italic.woff");
      const fontData = readFileSync(latoItalicPath);
      
      const unified = await orchestrator.parseFont(fontData);
      expect(unified).toBeDefined();
      
      const root = new LayoutNode(new ComputedStyle());
      const paragraph = new LayoutNode(new ComputedStyle({ display: Display.Block }));
      const text = new LayoutNode(
        new ComputedStyle({ 
          display: Display.Inline, 
          fontSize: 12, 
          fontFamily: "Lato",
          fontWeight: 400,
          fontStyle: "italic"
        }),
        [],
        { textContent: "Hello italic WOFF" },
      );
      paragraph.appendChild(text);
      root.appendChild(paragraph);

      layoutTree(root, { width: 500, height: 500 });
      const renderable = buildRenderTree(root, {
        stylesheets: {
          fontFaces: [{ 
            family: "Lato", 
            src: [`url(${latoItalicPath})`]
          }],
        },
      });
      const pdfBytes = await renderPdf(renderable);

      const parser = new PDFParse({ data: Buffer.from(pdfBytes) });
      const result = await parser.getText();
      expect(result.text).toContain("Hello italic WOFF");
    });

    it("should handle bold WOFF font variant", async () => {
      const latoBoldPath = join(process.cwd(), "assets/fonts/woff/lato/lato-latin-700-normal.woff");
      const fontData = readFileSync(latoBoldPath);
      
      const unified = await orchestrator.parseFont(fontData);
      expect(unified).toBeDefined();
      
      const root = new LayoutNode(new ComputedStyle());
      const paragraph = new LayoutNode(new ComputedStyle({ display: Display.Block }));
      const text = new LayoutNode(
        new ComputedStyle({ 
          display: Display.Inline, 
          fontSize: 12, 
          fontFamily: "Lato",
          fontWeight: 700,
          fontStyle: "normal"
        }),
        [],
        { textContent: "Hello bold WOFF" },
      );
      paragraph.appendChild(text);
      root.appendChild(paragraph);

      layoutTree(root, { width: 500, height: 500 });
      const renderable = buildRenderTree(root, {
        stylesheets: {
          fontFaces: [{ 
            family: "Lato", 
            src: [`url(${latoBoldPath})`]
          }],
        },
      });
      const pdfBytes = await renderPdf(renderable);

      const parser = new PDFParse({ data: Buffer.from(pdfBytes) });
      const result = await parser.getText();
      expect(result.text).toContain("Hello bold WOFF");
    });
  });

  describe("WOFF2 Font Rendering", () => {
    it("should render text with WOFF2 font in PDF", async () => {
      const latoNormalPath = join(process.cwd(), "assets/fonts/woff2/lato/lato-latin-400-normal.woff2");
      const fontData = readFileSync(latoNormalPath);
      
      // Test WOFF2 parsing through orchestrator
      const unified = await orchestrator.parseFont(fontData);
      expect(unified).toBeDefined();
      expect(unified.metrics).toBeDefined();

      // Create a simple layout with WOFF2 font
      const root = new LayoutNode(new ComputedStyle());
      const paragraph = new LayoutNode(new ComputedStyle({ display: Display.Block }));
      const text = new LayoutNode(
        new ComputedStyle({ 
          display: Display.Inline, 
          fontSize: 12, 
          fontFamily: "Lato",
          fontWeight: 400,
          fontStyle: "normal"
        }),
        [],
        { textContent: "Hello WOFF2 world" },
      );
      paragraph.appendChild(text);
      root.appendChild(paragraph);

      layoutTree(root, { width: 500, height: 500 });
      const renderable = buildRenderTree(root, {
        stylesheets: {
          fontFaces: [{ 
            family: "Lato", 
            src: [`url(${latoNormalPath})`]
          }],
        },
      });
      const pdfBytes = await renderPdf(renderable);

      const parser = new PDFParse({ data: Buffer.from(pdfBytes) });
      const result = await parser.getText();
      expect(result.text).toContain("Hello WOFF2 world");
    });

    it("should handle Caveat WOFF2 font", async () => {
      const caveatPath = join(process.cwd(), "assets/fonts/woff2/caveat/Caveat-Regular.woff2");
      const fontData = readFileSync(caveatPath);
      
      const unified = await orchestrator.parseFont(fontData);
      expect(unified).toBeDefined();
      
      const root = new LayoutNode(new ComputedStyle());
      const paragraph = new LayoutNode(new ComputedStyle({ display: Display.Block }));
      const text = new LayoutNode(
        new ComputedStyle({ 
          display: Display.Inline, 
          fontSize: 16, 
          fontFamily: "Caveat",
          fontWeight: 400,
          fontStyle: "normal"
        }),
        [],
        { textContent: "Caveat font test" },
      );
      paragraph.appendChild(text);
      root.appendChild(paragraph);

      layoutTree(root, { width: 500, height: 500 });
      const renderable = buildRenderTree(root, {
        stylesheets: {
          fontFaces: [{ 
            family: "Caveat", 
            src: [`url(${caveatPath})`]
          }],
        },
      });
      const pdfBytes = await renderPdf(renderable);

      const parser = new PDFParse({ data: Buffer.from(pdfBytes) });
      const result = await parser.getText();
      expect(result.text).toContain("Caveat font test");
    });
  });

  describe("Font Format Comparison", () => {
    it("should show WOFF vs WOFF2 parsing consistency", async () => {
      // Test both WOFF and WOFF2 versions of the same font
      const woffPath = join(process.cwd(), "assets/fonts/woff/lato/lato-latin-400-normal.woff");
      const woff2Path = join(process.cwd(), "assets/fonts/woff2/lato/lato-latin-400-normal.woff2");
      
      const woffData = readFileSync(woffPath);
      const woff2Data = readFileSync(woff2Path);
      
      const woffUnified = await orchestrator.parseFont(woffData);
      const woff2Unified = await orchestrator.parseFont(woff2Data);
      
      // Both should produce valid metrics (allowing for implementation differences)
      expect(woffUnified.metrics.metrics.unitsPerEm).toBeGreaterThan(0);
      expect(woff2Unified.metrics.metrics.unitsPerEm).toBeGreaterThan(0);
      expect(woffUnified.metrics.glyphMetrics.size).toBeGreaterThan(0);
      expect(woff2Unified.metrics.glyphMetrics.size).toBeGreaterThan(0);
      
      console.log(`WOFF: ${woffUnified.metrics.glyphMetrics.size} glyphs, ${woffUnified.metrics.metrics.unitsPerEm} unitsPerEm`);
      console.log(`WOFF2: ${woff2Unified.metrics.glyphMetrics.size} glyphs, ${woff2Unified.metrics.metrics.unitsPerEm} unitsPerEm`);
    });
  });

  describe("Deterministic Rendering", () => {
    it("should produce deterministic PDF with WOFF font", async () => {
      const latoNormalPath = join(process.cwd(), "assets/fonts/woff/lato/lato-latin-400-normal.woff");
      const fontData = readFileSync(latoNormalPath);
      
      const root = new LayoutNode(new ComputedStyle());
      const paragraph = new LayoutNode(new ComputedStyle({ display: Display.Block }));
      const text = new LayoutNode(
        new ComputedStyle({ 
          display: Display.Inline, 
          fontSize: 12, 
          fontFamily: "Lato",
          fontWeight: 400,
          fontStyle: "normal"
        }),
        [],
        { textContent: "Deterministic WOFF test" },
      );
      paragraph.appendChild(text);
      root.appendChild(paragraph);

      layoutTree(root, { width: 500, height: 500 });
      const renderable = buildRenderTree(root, {
        stylesheets: {
          fontFaces: [{ 
            family: "Lato", 
            src: [`url(${latoNormalPath})`]
          }],
        },
      });

      // Generate PDF twice (deterministic by default)
      const pdfBytes1 = await renderPdf(renderable);
      const pdfBytes2 = await renderPdf(renderable);
      
      // Should produce identical PDFs
      expect(pdfBytes1).toEqual(pdfBytes2);
    });

    it("should produce deterministic PDF with WOFF2 font", async () => {
      const latoNormalPath = join(process.cwd(), "assets/fonts/woff2/lato/lato-latin-400-normal.woff2");
      const fontData = readFileSync(latoNormalPath);
      
      const root = new LayoutNode(new ComputedStyle());
      const paragraph = new LayoutNode(new ComputedStyle({ display: Display.Block }));
      const text = new LayoutNode(
        new ComputedStyle({ 
          display: Display.Inline, 
          fontSize: 12, 
          fontFamily: "Lato",
          fontWeight: 400,
          fontStyle: "normal"
        }),
        [],
        { textContent: "Deterministic WOFF2 test" },
      );
      paragraph.appendChild(text);
      root.appendChild(paragraph);

      layoutTree(root, { width: 500, height: 500 });
      const renderable = buildRenderTree(root, {
        stylesheets: {
          fontFaces: [{ 
            family: "Lato", 
            src: [`url(${latoNormalPath})`]
          }],
        },
      });

      // Generate PDF twice (deterministic by default)
      const pdfBytes1 = await renderPdf(renderable);
      const pdfBytes2 = await renderPdf(renderable);
      
      // Should produce identical PDFs
      expect(pdfBytes1).toEqual(pdfBytes2);
    });
  });
});
