import { describe, it, expect } from "vitest";
import { TextRenderer } from "../../src/pdf/renderers/text-renderer.js";
import { CoordinateTransformer } from "../../src/pdf/utils/coordinate-transformer.js";
import { GraphicsStateManager } from "../../src/pdf/renderers/graphics-state-manager.js";
import type { FontRegistry, FontResource } from "../../src/pdf/font/font-registry.js";
import type { GlyphRun } from "../../src/layout/text-run.js";
import type { PdfFontSubset } from "../../src/pdf/font/font-subset.js";
import type { Run, TextShadowLayer } from "../../src/pdf/types.js";
import type { UnifiedFont } from "../../src/fonts/types.js";

class StubFontRegistry {
  private readonly font: FontResource = {
    baseFont: "FakeSans",
    resourceName: "F1",
    ref: { objectNumber: 1 },
    isBase14: true,
  };

  async ensureFontResource(): Promise<FontResource> {
    return this.font;
  }

  ensureFontResourceSync(): FontResource {
    return this.font;
  }

  getDefaultFontStack(): string[] {
    return [];
  }

  ensureSubsetForGlyphRun(glyphRun: GlyphRun, font: FontResource): { alias: string; subset: PdfFontSubset; ref: any; font: FontResource } {
    const subset: PdfFontSubset = {
      name: "/GS1",
      firstChar: 0,
      lastChar: Math.max(...glyphRun.glyphIds),
      widths: [],
      toUnicodeCMap: "",
      fontFile: new Uint8Array(0),
      encodeGlyph: (gid: number) => gid,
      glyphIds: [...glyphRun.glyphIds],
    };
    return { alias: "GS1", subset, ref: { objectNumber: 2 }, font };
  }

  // Unused in this stubbed scenario
  getEmbedder(): null {
    return null;
  }
}

describe("TextRenderer glyph-run shadows", () => {
  it("emits shadow draw commands before the glyph-run text using base font alias", async () => {
    const glyphRun: GlyphRun = {
      font: {
        metrics: {
          metrics: {
            unitsPerEm: 1000,
            ascender: 800,
            descender: -200,
            lineGap: 0,
            capHeight: 700,
            xHeight: 500,
          },
          glyphMetrics: new Map([[10, { advanceWidth: 500, leftSideBearing: 0 }], [20, { advanceWidth: 500, leftSideBearing: 0 }]]),
          cmap: {
            getGlyphId: (cp: number) => (cp === 0x48 ? 10 : 20),
            hasCodePoint: () => true,
            unicodeMap: new Map([[0x48, 10], [0x69, 20]]),
          },
        },
        program: { sourceFormat: "ttf", unitsPerEm: 1000, glyphCount: 2 },
      } as UnifiedFont,
      glyphIds: [10, 20],
      positions: [{ x: 0, y: 0 }, { x: 500, y: 0 }],
      text: "Hi",
      fontSize: 20,
    };

    const textShadows: TextShadowLayer[] = [
      { inset: false, offsetX: 2, offsetY: 2, blur: 0, spread: 0, color: { r: 255, g: 0, b: 0, a: 1 } },
    ];

    const run: Run = {
      text: "Hi",
      fontFamily: "FakeSans",
      fontSize: 20,
      fontWeight: 400,
      fontStyle: "normal",
      fill: { r: 0, g: 0, b: 0, a: 1 },
      lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 30 },
      glyphs: glyphRun,
      textShadows,
    } as Run;

    const transformer = new CoordinateTransformer(200, (px: number) => px * 0.75, 0);
    const fontRegistry = new StubFontRegistry();
    const gsm = new GraphicsStateManager();
    const renderer = new TextRenderer(transformer, fontRegistry as unknown as FontRegistry, undefined, gsm);

    await renderer.drawTextRun(run);

    const output = renderer.getResult().commands.join(" ");

    // Shadow (base font) should be emitted before the subset glyph-run draw
    const shadowIndex = output.indexOf("/F1");
    const subsetIndex = output.indexOf("/GS1");
    expect(shadowIndex).toBeGreaterThanOrEqual(0);
    expect(subsetIndex).toBeGreaterThan(shadowIndex);

    // Ensure both shadow and main text are present (two BT markers)
    const btCount = (output.match(/\bBT\b/g) ?? []).length;
    expect(btCount).toBeGreaterThanOrEqual(2);
  });
});
