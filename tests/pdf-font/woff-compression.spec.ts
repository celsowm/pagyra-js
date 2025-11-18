import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { WoffEngine } from "../../src/fonts/engines/woff-engine.js";
import { FontOrchestrator } from "../../src/fonts/orchestrator.js";

describe("WOFF Font Compression", () => {
  let woffEngine: WoffEngine;
  let orchestrator: FontOrchestrator;

  beforeEach(() => {
    woffEngine = new WoffEngine();
    orchestrator = new FontOrchestrator();
  });

  describe("WOFF Engine", () => {
    it("should detect WOFF format correctly", () => {
      const latoNormalPath = join(process.cwd(), "assets/fonts/woff/lato/lato-latin-400-normal.woff");
      const fontData = readFileSync(latoNormalPath);
      
      // WOFF signature is 'wOFF'
      const signature = String.fromCharCode(fontData[0], fontData[1], fontData[2], fontData[3]);
      expect(signature).toBe("wOFF");
    });

    it("should parse WOFF font structure", async () => {
      const latoNormalPath = join(process.cwd(), "assets/fonts/woff/lato/lato-latin-400-normal.woff");
      const fontData = readFileSync(latoNormalPath);
      
      const parsed = await woffEngine.parse(fontData);
      expect(parsed).toBeDefined();
      expect(parsed.tables).toBeDefined();
      expect(Object.keys(parsed.tables).length).toBeGreaterThan(0);
    });

    it("should convert WOFF to unified font format", async () => {
      const latoNormalPath = join(process.cwd(), "assets/fonts/woff/lato/lato-latin-400-normal.woff");
      const fontData = readFileSync(latoNormalPath);
      
      const parsed = await woffEngine.parse(fontData);
      const unified = await woffEngine.convertToUnified(parsed);
      
      expect(unified).toBeDefined();
      expect(unified.metrics).toBeDefined();
      expect(unified.metrics.glyphMetrics).toBeDefined();
      expect(unified.metrics.metrics.unitsPerEm).toBeGreaterThan(0);
    });

    it("should handle different WOFF font weights", async () => {
      const fonts = [
        "lato-latin-400-normal.woff",
        "lato-latin-400-italic.woff", 
        "lato-latin-700-normal.woff",
        "lato-latin-700-italic.woff"
      ];
      
      for (const fontFile of fonts) {
        const fontPath = join(process.cwd(), "assets/fonts/woff/lato", fontFile);
        const fontData = readFileSync(fontPath);
        
        const parsed = await woffEngine.parse(fontData);
        const unified = await woffEngine.convertToUnified(parsed);
        
        expect(unified).toBeDefined();
        expect(unified.metrics).toBeDefined();
        expect(unified.metrics.metrics.unitsPerEm).toBeGreaterThan(0);
        console.log(`✓ Successfully processed ${fontFile}`);
      }
    });
  });

  describe("WOFF Integration with Orchestrator", () => {
    it("should parse WOFF fonts through orchestrator", async () => {
      const latoNormalPath = join(process.cwd(), "assets/fonts/woff/lato/lato-latin-400-normal.woff");
      const fontData = readFileSync(latoNormalPath);
      
      const unified = await orchestrator.parseFont(fontData);
      
      expect(unified).toBeDefined();
      expect(unified.metrics).toBeDefined();
      expect(unified.metrics.glyphMetrics.size).toBeGreaterThan(0);
    });

    it("should maintain deterministic output for same WOFF input", async () => {
      const latoNormalPath = join(process.cwd(), "assets/fonts/woff/lato/lato-latin-400-normal.woff");
      const fontData = readFileSync(latoNormalPath);
      
      const unified1 = await orchestrator.parseFont(fontData);
      const unified2 = await orchestrator.parseFont(fontData);
      
      // Both should have same units per em
      expect(unified1.metrics.metrics.unitsPerEm).toBe(unified2.metrics.metrics.unitsPerEm);
      // Both should have same glyph count
      expect(unified1.metrics.glyphMetrics.size).toBe(unified2.metrics.glyphMetrics.size);
    });
  });

  describe("WOFF Decompression", () => {
    it("should properly decompress WOFF table data", async () => {
      const latoNormalPath = join(process.cwd(), "assets/fonts/woff/lato/lato-latin-400-normal.woff");
      const fontData = readFileSync(latoNormalPath);
      
      const parsed = await woffEngine.parse(fontData);
      
      // Check that we can access decompressed table data
      expect(parsed.tables['glyf']).toBeDefined();
      expect(parsed.tables['head']).toBeDefined();
      expect(parsed.tables['hhea']).toBeDefined();
      
      // Verify table data is not empty
      const glyfTable = parsed.tables['glyf'];
      if (glyfTable) {
        expect(glyfTable.length).toBeGreaterThan(0);
      }
    });
  });
});
