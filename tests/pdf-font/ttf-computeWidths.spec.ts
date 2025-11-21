import { describe, it, expect } from "vitest";
import { computeWidths } from "../../src/pdf/font/embedder.js";
import { TtfFontMetrics } from "../../src/types/fonts.js";

describe("computeWidths", () => {
  it("computes DW as the mode and compresses W with ranges and lists", () => {
    // Build synthetic glyphMetrics with 12 glyphs and specific advance widths (unitsPerEm = 1000)
    const glyphMetrics = new Map<number, { advanceWidth: number; leftSideBearing: number }>();
    // widths (in font units) -> after scaling (unitsPerEm=1000) they become the same numbers (since unitsPerEm=1000)
    // We'll set many 500's so DW=500
    const adv = [
      500, // 0
      500, // 1
      500, // 2
      500, // 3
      600, // 4
      700, // 5
      700, // 6
      700, // 7
      800, // 8
      900, // 9
      500, // 10
      1000 //11
    ];
    for (let i = 0; i < adv.length; i++) {
      glyphMetrics.set(i, { advanceWidth: adv[i], leftSideBearing: 0 });
    }

    const metrics = new TtfFontMetrics(
      { unitsPerEm: 1000, ascender: 0, descender: 0, lineGap: 0, capHeight: 0, xHeight: 0 },
      glyphMetrics,
      {
        getGlyphId: () => 0,
        hasCodePoint: () => false,
        unicodeMap: new Map()
      }
    );

    const { DW, W } = computeWidths(metrics);

    // DW should be 500 (most frequent)
    expect(DW).toBe(500);

    // W entries are emitted as a flat array: start, [w1...wn] OR start, end, w
    // None of the explicit widths should match DW.
    let idx = 0;
    while (idx < W.length) {
      const start = W[idx++] as number;
      const next = W[idx];
      let widths: number[] = [];
      if (Array.isArray(next)) {
        widths = next as number[];
        idx++;
      } else {
        const end = next as number;
        const widthVal = W[idx + 1] as number;
        idx += 2;
        widths = new Array(end - start + 1).fill(widthVal);
      }
      for (const v of widths) {
        expect(v).not.toBe(DW);
      }
    }

    // Expect at least one W entry (since there are non-DW glyphs)
    expect(W.length).toBeGreaterThan(0);
  });
});
