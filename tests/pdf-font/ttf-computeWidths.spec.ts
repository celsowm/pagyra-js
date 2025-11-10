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

    // W should not include entries for glyphs equal to DW (0,1,2,3,10)
    // Ensure all entries reference gids that are not equal to DW
    for (const entry of W) {
      const e: any = entry as any;
      // W entries are either [start, end, value] or [start, [w1,w2,...]]
      if (Array.isArray(e[1])) {
        const [start, arr] = e as [number, number[]];
        for (const v of arr) expect(v).not.toBe(DW);
      } else if (typeof e[2] === "number") {
        const [start, end, value] = e as [number, number, number];
        expect(value).not.toBe(DW);
      } else {
        // unexpected shape; fail the test to surface issue
        expect(false).toBeTruthy();
      }
    }

    // Expect at least one W entry (since there are non-DW glyphs)
    expect(W.length).toBeGreaterThan(0);
  });
});
