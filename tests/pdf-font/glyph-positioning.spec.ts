import { describe, it, expect } from "vitest";
import { computeGlyphRun } from "../../src/pdf/utils/node-text-run-factory.js";
import type { UnifiedFont } from "../../src/fonts/types.js";

const mockFont = (advanceWidth: number): UnifiedFont => ({
  metrics: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
      lineGap: 0,
      capHeight: 700,
      xHeight: 500,
    },
    glyphMetrics: new Map([[1, { advanceWidth, leftSideBearing: 0 }]]),
    cmap: {
      getGlyphId: () => 1,
      hasCodePoint: () => true,
      unicodeMap: new Map([[65, 1]]), // 'A'
    },
  },
  program: {
    sourceFormat: "ttf",
    unitsPerEm: 1000,
    glyphCount: 2,
  },
});

describe("computeGlyphRun", () => {
  it("applies letter-spacing between glyphs", () => {
    const font = mockFont(500); // 0.5em
    const run = computeGlyphRun(font, "AAA", 10, 2); // fontSize=10px, letterSpacing=2px

    expect(run.glyphIds).toEqual([1, 1, 1]);
    expect(run.positions.map((p) => p.x)).toEqual([0, 7, 14]); // 5px advance + 2px spacing
    expect(run.width).toBeCloseTo(19); // 3 advances (5px each) + two spacings (2px each)
  });
});
