import { describe, it, expect } from "vitest";
import { parseTtfFont } from "../../src/pdf/font/ttf-lite.js";
import { flattenOutline, rasterizeContours } from "../../src/pdf/font/rasterizer.js";

const fontPath = "assets/fonts/DejaVuSans.ttf";

describe("Rasterizer (minimal)", () => {
  it("should flatten and rasterize glyph 'A' producing a non-empty alpha mask", () => {
    const metrics = parseTtfFont(fontPath);
    const gid = metrics.cmap.getGlyphId("A".codePointAt(0)!);
    const cmds = metrics.getGlyphOutline ? metrics.getGlyphOutline(gid) : null;
    expect(cmds).not.toBeNull();

    const unitsPerEm = metrics.metrics.unitsPerEm;
    const fontSizePx = 64;
    const scale = fontSizePx / unitsPerEm;

    const { contours } = flattenOutline(cmds!, scale, 0.5);
    expect(contours.length).toBeGreaterThan(0);

    const mask = rasterizeContours(contours, 4);
    expect(mask).not.toBeNull();
    expect(mask!.width).toBeGreaterThan(0);
    expect(mask!.height).toBeGreaterThan(0);

    // Ensure mask contains some non-zero alpha pixels
    const hasNonZero = mask!.data.some((v) => v > 0);
    expect(hasNonZero).toBe(true);
  });
});
