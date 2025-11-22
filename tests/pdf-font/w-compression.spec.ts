import { describe, it, expect } from "vitest";
import { computeWidths } from "../../src/pdf/font/widths.js";
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
    // glyphs 0-3 = 500 (run length 4) -> should produce a c_first c_last w sequence
    const adv = [
      100, 100, 100, 100, 100, 100, // ensure DW = 100 (majority)
      500, 500, 500, 500, // run of 4 (non-DW)
      600, 700, 800
    ];
    const metrics = makeMetrics(adv);
    const { W } = computeWidths(metrics);

    // W is a flat array of mixed types. We need to scan it.
    let foundRange = false;
    for (let i = 0; i < W.length; i++) {
      // Look for sequence: number, number, number where middle > first
      if (typeof W[i] === 'number' && typeof W[i + 1] === 'number' && typeof W[i + 2] === 'number') {
        const start = W[i] as number;
        const end = W[i + 1] as number;
        const val = W[i + 2] as number;
        // Check if this looks like our range
        if (start === 6 && end === 9 && val === 500) {
          foundRange = true;
          break;
        }
      }
    }
    expect(foundRange).toBe(true);
  });

  it("does not use range form for runs < 4 (uses array/list instead)", () => {
    // glyphs 0-2 = 400 (run length 3) -> should NOT create a range for this run
    const adv = [
      100, 100, 100, // ensure DW = 100
      400, 400, 400, // run length 3 (non-DW)
      500, 600
    ];
    const metrics = makeMetrics(adv);
    const { W } = computeWidths(metrics);

    // Scan for range 0..2
    let foundRange = false;
    for (let i = 0; i < W.length; i++) {
      if (typeof W[i] === 'number' && typeof W[i + 1] === 'number' && typeof W[i + 2] === 'number') {
        const start = W[i] as number;
        const end = W[i + 1] as number;
        const val = W[i + 2] as number;
        if (start === 0 && end === 2 && val === 400) {
          foundRange = true;
        }
      }
    }
    expect(foundRange).toBe(false);

    // ensure there's an array entry that includes the start 0 (list form)
    // Format: c [w1 ... wn]
    let foundList = false;
    for (let i = 0; i < W.length; i++) {
      if (typeof W[i] === 'number' && Array.isArray(W[i + 1])) {
        const start = W[i] as number;
        // The list starts at 3 because 0,1,2 are 100 (DW). 3,4,5 are 400. 6 is 500. 7 is 600.
        // So it should be one list starting at 3 containing [400, 400, 400, 500, 600]
        if (start === 3) {
          const list = W[i + 1] as number[];
          if (list.length >= 3 && list[0] === 400 && list[1] === 400 && list[2] === 400) {
            foundList = true;
          }
        }
      }
    }
    expect(foundList).toBe(true);
  });

  it("splits heterogeneous lists to max length 32", () => {
    // Build a run of 80 consecutive non-DW widths starting at gid 0
    const adv: number[] = [];
    // insert some DW values (2000) to keep DW outside the distinct run
    for (let k = 0; k < 5; k++) adv.push(2000);
    for (let i = 0; i < 80; i++) adv.push(1000 + i); // distinct widths to be chunked
    const metrics = makeMetrics(adv);
    const { W } = computeWidths(metrics);

    // Scan W for list entries
    const listLengths: number[] = [];
    let covered = 0;

    for (let i = 0; i < W.length; i++) {
      if (typeof W[i] === 'number' && Array.isArray(W[i + 1])) {
        const list = W[i + 1] as number[];
        listLengths.push(list.length);
        covered += list.length;
        i++; // skip the array
      } else if (typeof W[i] === 'number' && typeof W[i + 1] === 'number' && typeof W[i + 2] === 'number') {
        // range
        const start = W[i] as number;
        const end = W[i + 1] as number;
        covered += (end - start + 1);
        i += 2;
      }
    }

    expect(listLengths.length).toBeGreaterThanOrEqual(1);
    for (const len of listLengths) {
      expect(len).toBeLessThanOrEqual(32);
    }
    expect(covered).toBe(80);
  });
});
