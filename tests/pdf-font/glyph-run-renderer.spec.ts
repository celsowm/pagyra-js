import { describe, it, expect } from "vitest";
import { drawGlyphRun } from "../../src/pdf/utils/glyph-run-renderer.js";
import type { GlyphRun } from "../../src/layout/text-run.js";
import type { PdfFontSubset } from "../../src/pdf/font/font-subset.js";
import type { UnifiedFont } from "../../src/fonts/types.js";

describe("GlyphRun Renderer", () => {
    it("should generate correct PDF commands for a GlyphRun", () => {
        const mockFont: UnifiedFont = {
            metrics: {
                metrics: {
                    unitsPerEm: 1000,
                    ascender: 800,
                    descender: -200,
                    lineGap: 0,
                    capHeight: 700,
                    xHeight: 500,
                },
                glyphMetrics: new Map([
                    [0, { advanceWidth: 500, leftSideBearing: 0 }],
                    [1, { advanceWidth: 600, leftSideBearing: 50 }],
                    [2, { advanceWidth: 250, leftSideBearing: 50 }],
                ]),
                cmap: {
                    getGlyphId: () => 0,
                    hasCodePoint: () => true,
                    unicodeMap: new Map([[72, 1], [105, 2]]),
                },
            },
            program: {
                sourceFormat: "ttf",
                unitsPerEm: 1000,
                glyphCount: 3,
            },
        };

        const glyphRun: GlyphRun = {
            font: mockFont,
            glyphIds: [1, 2], // 'Hi'
            positions: [{ x: 0, y: 0 }, { x: 600, y: 0 }],
            text: "Hi",
            fontSize: 12,
        };

        const mockSubset: PdfFontSubset = {
            name: "/F1",
            firstChar: 0,
            lastChar: 2,
            widths: [500, 600, 250],
            toUnicodeCMap: "",
            fontFile: new Uint8Array(0),
            encodeGlyph: (gid: number) => gid, // Simple 1:1 mapping
        };

        const commands = drawGlyphRun(
            glyphRun,
            mockSubset,
            100, // x
            200, // y
            12, // font size
            { r: 0, g: 0, b: 0, a: 1 }
        );

        expect(commands).toContain("BT");
        expect(commands).toContain("ET");
        expect(commands).toContain("/F1 12.00 Tf");
        expect(commands).toContain("100.00 200.00 Td");
        // TJ array with hex glyphs
        expect(commands.find(c => c.includes("TJ"))).toBeDefined();
    });

    it("should handle different colors", () => {
        const mockFont: UnifiedFont = {
            metrics: {
                metrics: {
                    unitsPerEm: 1000,
                    ascender: 800,
                    descender: -200,
                    lineGap: 0,
                    capHeight: 700,
                    xHeight: 500,
                },
                glyphMetrics: new Map([[0, { advanceWidth: 500, leftSideBearing: 0 }]]),
                cmap: {
                    getGlyphId: () => 0,
                    hasCodePoint: () => true,
                    unicodeMap: new Map(),
                },
            },
            program: {
                sourceFormat: "ttf",
                unitsPerEm: 1000,
                glyphCount: 1,
            },
        };

        const glyphRun: GlyphRun = {
            font: mockFont,
            glyphIds: [0],
            positions: [{ x: 0, y: 0 }],
            text: "",
            fontSize: 12,
        };

        const mockSubset: PdfFontSubset = {
            name: "/F1",
            firstChar: 0,
            lastChar: 0,
            widths: [500],
            toUnicodeCMap: "",
            fontFile: new Uint8Array(0),
            encodeGlyph: (gid) => gid,
        };

        const commands = drawGlyphRun(
            glyphRun,
            mockSubset,
            0,
            0,
            12,
            { r: 1, g: 0, b: 0, a: 1 } // Red
        );

        expect(commands).toContain("1.000 0.000 0.000 rg");
    });
});
