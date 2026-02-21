import { TextRenderer } from "../../src/pdf/renderers/text-renderer.js";
import { CoordinateTransformer } from "../../src/pdf/utils/coordinate-transformer.js";
import type { FontRegistry, FontResource } from "../../src/pdf/font/font-registry.js";
import type { Run } from "../../src/pdf/types.js";
import type { GlyphRun } from "../../src/layout/text-run.js";
import type { UnifiedFont } from "../../src/fonts/types.js";
import { TtfFontMetrics } from "../../src/types/fonts.js";
import { TextFontResolver } from "../../src/pdf/renderers/text-font-resolver.js";

describe("text renderer glyph fallback", () => {
  it("rebuilds glyph runs when the resolved font differs from the precomputed one", async () => {
    const marker = "\u25E6";
    const markerCp = marker.codePointAt(0)!;
    const baseMetrics = {
      unitsPerEm: 1000,
      ascender: 0,
      descender: 0,
      lineGap: 0,
      capHeight: 0,
      xHeight: 0,
    };
    const glyphMetrics = new Map([
      [0, { advanceWidth: 500, leftSideBearing: 0 }],
      [1, { advanceWidth: 500, leftSideBearing: 0 }],
    ]);

    const missingCmap = {
      getGlyphId: (_codePoint: number) => 0,
      hasCodePoint: (_codePoint: number) => false,
      unicodeMap: new Map<number, number>(),
    };
    const presentCmap = {
      getGlyphId: (codePoint: number) => (codePoint === markerCp ? 1 : 0),
      hasCodePoint: (codePoint: number) => codePoint === markerCp,
      unicodeMap: new Map<number, number>([[markerCp, 1]]),
    };

    const missingMetrics = new TtfFontMetrics(baseMetrics, glyphMetrics, missingCmap);
    const presentMetrics = new TtfFontMetrics(baseMetrics, glyphMetrics, presentCmap);

    const primaryFont: FontResource = {
      baseFont: "PrimaryFont",
      resourceName: "F1",
      ref: { objectNumber: 1 },
      isBase14: false,
      metrics: missingMetrics,
    };
    const fallbackFont: FontResource = {
      baseFont: "FallbackFont",
      resourceName: "F2",
      ref: { objectNumber: 2 },
      isBase14: false,
      metrics: presentMetrics,
    };

    const fontRegistry = {
      ensureFontResource: async (family?: string) => (family === "FallbackFont" ? fallbackFont : primaryFont),
      getDefaultFontStack: () => ["FallbackFont"],
      ensureSubsetForGlyphRun: (glyphRun: GlyphRun, font: FontResource) => ({
        alias: "GS1",
        subset: {
          name: "/GS1",
          firstChar: 0,
          lastChar: 1,
          widths: [500, 500],
          toUnicodeCMap: "",
          fontFile: new Uint8Array(),
          encodeGlyph: (gid: number) => gid,
          glyphIds: glyphRun.glyphIds,
        },
        ref: { objectNumber: 3 },
        font,
      }),
    };

    const transformer = new CoordinateTransformer(100, (value) => value, 0);
    const renderer = new TextRenderer(transformer, fontRegistry as unknown as FontRegistry);

    const unifiedPrimary: UnifiedFont = {
      metrics: {
        metrics: missingMetrics.metrics,
        glyphMetrics: missingMetrics.glyphMetrics,
        cmap: missingMetrics.cmap,
        headBBox: missingMetrics.headBBox,
      },
      program: {
        sourceFormat: "ttf",
        unitsPerEm: missingMetrics.metrics.unitsPerEm,
        glyphCount: missingMetrics.glyphMetrics.size,
      },
      css: {
        family: "PrimaryFont",
        weight: 400,
        style: "normal",
      },
    };
    const glyphRun: GlyphRun = {
      font: unifiedPrimary,
      glyphIds: [0],
      positions: [{ x: 0, y: 0 }],
      text: marker,
      fontSize: 12,
    };

    const run: Run = {
      text: marker,
      fontFamily: "PrimaryFont",
      fontSize: 12,
      fontWeight: 400,
      fontStyle: "normal",
      fill: { r: 0, g: 0, b: 0, a: 1 },
      lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      glyphs: glyphRun,
    };

    await renderer.drawTextRun(run);

    expect(run.glyphs?.glyphIds[0]).toBe(1);
    expect(run.glyphs?.font.metrics.cmap).toBe(presentMetrics.cmap);
  });

  it("tries default stack when requested family cannot render unicode glyph", async () => {
    const arrow = "\u2192";
    const arrowCp = arrow.codePointAt(0)!;
    const baseMetrics = {
      unitsPerEm: 1000,
      ascender: 0,
      descender: 0,
      lineGap: 0,
      capHeight: 0,
      xHeight: 0,
    };
    const glyphMetrics = new Map([
      [0, { advanceWidth: 500, leftSideBearing: 0 }],
      [1, { advanceWidth: 500, leftSideBearing: 0 }],
    ]);

    const missingCmap = {
      getGlyphId: (_codePoint: number) => 0,
      hasCodePoint: (_codePoint: number) => false,
      unicodeMap: new Map<number, number>(),
    };
    const presentCmap = {
      getGlyphId: (_codePoint: number) => 1,
      hasCodePoint: (_codePoint: number) => true,
      unicodeMap: new Map<number, number>([[arrowCp, 1]]),
    };

    const primaryFont: FontResource = {
      baseFont: "PrimaryFont",
      resourceName: "F1",
      ref: { objectNumber: 1 },
      isBase14: false,
      metrics: new TtfFontMetrics(baseMetrics, glyphMetrics, missingCmap),
    };

    const fallbackFont: FontResource = {
      baseFont: "FallbackFont",
      resourceName: "F2",
      ref: { objectNumber: 2 },
      isBase14: false,
      metrics: new TtfFontMetrics(baseMetrics, glyphMetrics, presentCmap),
    };

    const fontRegistry = {
      ensureFontResource: async (family?: string) => (family === "FallbackFont" ? fallbackFont : primaryFont),
      getDefaultFontStack: () => ["FallbackFont"],
      ensureSubsetForGlyphRun: () => {
        throw new Error("ensureSubsetForGlyphRun should not be called in this test");
      },
    } as unknown as FontRegistry;

    const resolver = new TextFontResolver(fontRegistry);
    const resolved = await resolver.ensureFontResource({
      fontFamily: "PrimaryFont",
      text: `HTML${arrow}PDF`,
    });

    expect(resolved.baseFont).toBe("FallbackFont");
    expect(resolved.metrics?.cmap.getGlyphId(arrowCp)).toBe(1);
  });
});
