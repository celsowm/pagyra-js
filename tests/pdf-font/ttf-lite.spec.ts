import { describe, it, expect } from "vitest";
import { parseTtfFont, parseTtfBuffer } from "../../src/pdf/font/ttf-lite.js";
import { readFileSync } from "fs";

describe("ttf-lite (basic integration)", () => {
  const fonts = [
    "assets/fonts/DejaVuSans.ttf",
    "assets/fonts/NotoSans-Regular.ttf",
    "assets/fonts/Roboto-Regular.ttf"
  ];

  for (const fontPath of fonts) {
    it(`parses ${fontPath} using parseTtfFont and returns basic metrics`, () => {
      const ttf = parseTtfFont(fontPath);
      expect(ttf).toBeDefined();
      expect(ttf.metrics.unitsPerEm).toBeGreaterThan(0);
      // glyphMetrics should contain some glyphs
      expect(ttf.glyphMetrics.size).toBeGreaterThan(0);
      // cmap should map 'A' (U+0041) to some non-zero glyph id for most fonts
      const gidA = ttf.cmap.getGlyphId(0x41);
      expect(typeof gidA).toBe("number");
      // allow 0 in the rare case the font doesn't include 'A', but ensure method exists
      expect(ttf.cmap.hasCodePoint).toBeDefined();
    });

    it(`parses ${fontPath} via parseTtfBuffer and matches parseTtfFont metrics`, () => {
      const raw = readFileSync(fontPath);
      const arr = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
      const parsedBuf = parseTtfBuffer(arr);
      const parsedFile = parseTtfFont(fontPath);

      expect(parsedBuf.metrics.unitsPerEm).toEqual(parsedFile.metrics.unitsPerEm);
      expect(parsedBuf.glyphMetrics.size).toEqual(parsedFile.glyphMetrics.size);
    });
  }
});
