import { describe, it, expect } from "vitest";
import { parseTtfFont } from "../../src/pdf/font/ttf-lite.js";
import { readFileSync } from "fs";
import { join } from "path";

describe("TTF glyf/loca outline provider (minimal)", () => {
  const fontsDir = join(__dirname, "../../assets/fonts");
  const fontPath = join(process.cwd(), "assets/fonts/DejaVuSans.ttf");

  it("should produce outlines for ASCII letters (A, a)", () => {
    const metrics = parseTtfFont(fontPath);
    // map codepoints for 'A' and 'a'
    const gidA = metrics.cmap.getGlyphId("A".codePointAt(0)!);
    const gida = metrics.cmap.getGlyphId("a".codePointAt(0)!);

    // outlines provider present
    expect(typeof metrics.getGlyphOutline).toBe("function");

    const outlineA = metrics.getGlyphOutline ? metrics.getGlyphOutline(gidA) : null;
    const outlinea = metrics.getGlyphOutline ? metrics.getGlyphOutline(gida) : null;

    expect(outlineA).not.toBeNull();
    expect(outlinea).not.toBeNull();

    // Basic structure checks: arrays containing at least one moveTo and close
    const hasMoveToAndClose = (cmds: any[] | null) => {
      if (!cmds || cmds.length === 0) return false;
      let sawMove = false;
      let sawClose = false;
      for (const c of cmds) {
        if (c.type === "moveTo") sawMove = true;
        if (c.type === "close") sawClose = true;
      }
      return sawMove && sawClose;
    };

    expect(hasMoveToAndClose(outlineA as any[])).toBe(true);
    expect(hasMoveToAndClose(outlinea as any[])).toBe(true);
  });

  it("should return null for out-of-range gid", () => {
    const metrics = parseTtfFont(fontPath);
    const big = 999999;
    const outline = metrics.getGlyphOutline ? metrics.getGlyphOutline(big) : null;
    expect(outline).toBeNull();
  });
});
