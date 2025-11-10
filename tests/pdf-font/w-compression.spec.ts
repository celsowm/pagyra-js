import { describe, it, expect } from "vitest";
import { computeWidths } from "../../src/pdf/font/embedder.js";
import { TtfFontMetrics } from "../../src/types/fonts.js";

function makeMetrics(advances: number[]) {
  const glyphMetrics = new Map<number, { advanceWidth: number; leftSideBearing: number }>();
  for (let i = 0; i < advances.length; i++) {
    glyphMetrics.set(i, { advanceWidth: advances[i], leftSideBearing: 0 });
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

  return metrics;
}

describe("W compression heuristics", () => {
  it("computes DW as the statistical mode", () => {
    const adv = [
      100, 100, 100, // three 100s
      200, 200,      // two 200s
      300            // one 300
    ];
    const metrics = makeMetrics(adv);
    const { DW } = computeWidths(metrics);
    expect(DW).toBe(100);
  });

  it("uses range form for runs >= 4 identical widths", () => {
    // glyphs 0-3 = 500 (run length 4) -> should produce a [start,end,value] entry for 0..3
    const adv = [
      100, 100, 100, 100, 100, 100, // ensure DW = 100 (majority)
      500, 500, 500, 500, // run of 4 (non-DW)
      600, 700, 800
    ];
    const metrics = makeMetrics(adv);
    const { W } = computeWidths(metrics);

    // find any range entries [start,end,value]
    const rangeEntries = W.filter((e: any) => e.length === 3);
    expect(rangeEntries.length).toBeGreaterThan(0);
    // ensure one of the ranges covers the 4-long run (indices 6..9) with value 500
    const covers = rangeEntries.some((r: any) => r[0] === 6 && r[1] === 9 && r[2] === 500);
    expect(covers).toBe(true);
  });

  it("does not use range form for runs < 4 (uses array/list instead)", () => {
    // glyphs 0-2 = 400 (run length 3) -> should NOT create a [start,end,value] for this run
    const adv = [
      100, 100, 100, // ensure DW = 100
      400, 400, 400, // run length 3 (non-DW)
      500, 600
    ];
    const metrics = makeMetrics(adv);
    const { W } = computeWidths(metrics);

    const rangeEntries = W.filter((e: any) => e.length === 3);
    const hasSmallRange = rangeEntries.some((r: any) => r[0] === 0 && r[1] === 2 && r[2] === 400);
    expect(hasSmallRange).toBe(false);

    // ensure there's an array entry that includes the start 0 (list form)
    const listEntries = W.filter((e: any) => Array.isArray(e[1]));
    // for the small-run case the heterogenous list should start at index 3 (after DW entries)
    const includesStart = listEntries.some((l: any) => l[0] === 3);
    expect(includesStart).toBe(true);
  });

  it("splits heterogeneous lists to max length 32", () => {
    // Build a run of 80 consecutive non-DW widths starting at gid 0
    const adv: number[] = [];
    // insert some DW values (2000) to keep DW outside the distinct run
    for (let k = 0; k < 5; k++) adv.push(2000);
    for (let i = 0; i < 80; i++) adv.push(1000 + i); // distinct widths to be chunked
    const metrics = makeMetrics(adv);
    const { W } = computeWidths(metrics);

    // All entries will be lists (no DW) or ranges; ensure no list has length > 32
    const listEntries = W.filter((e: any) => Array.isArray(e[1]));
    expect(listEntries.length).toBeGreaterThanOrEqual(1);
    for (const le of listEntries) {
      const arr = le[1] as number[];
      expect(arr.length).toBeLessThanOrEqual(32);
    }

    // Ensure the lists combined cover the 80 glyphs (sum of list lengths + ranges lengths)
    let covered = 0;
    for (const e of W) {
      if (Array.isArray(e[1])) {
        covered += (e[1] as number[]).length;
      } else if ((e as any).length === 3) {
        // range entry [start, end, value]
        covered += ((e as any)[1] - (e as any)[0] + 1);
      }
    }
    expect(covered).toBe(80);
  });
});
