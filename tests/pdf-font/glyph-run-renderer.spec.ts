import { describe, it, expect } from "vitest";
import { drawGlyphRun } from "../../src/pdf/utils/glyph-run-renderer.js";
import type { GlyphRun } from "../../src/layout/text-run.js";
import type { PdfFontSubset } from "../../src/pdf/font/font-subset.js";
import type { UnifiedFont } from "../../src/fonts/types.js";
import { GraphicsStateManager } from "../../src/pdf/renderers/graphics-state-manager.js";

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
            glyphIds: [0, 1, 2],
        };

        const commands = drawGlyphRun(
            glyphRun,
            mockSubset,
            100, // x
            200, // y
            12, // font size
            { r: 0, g: 0, b: 0, a: 1 }
        );

        const content = commands.join(" ");

        expect(content).toContain("BT");
        expect(content).toContain("ET");
        expect(content).toMatch(/\/F1\s+12(?:\.0+)?\s+Tf/);
        expect(content).toMatch(/100(?:\.0+)?\s+200(?:\.0+)?\s+Td/);
        expect(content).toMatch(/<0001>/);
        expect(content).toMatch(/<0002>/);
        // TJ array with hex glyphs
        expect(content).toMatch(/TJ/);
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
            glyphIds: [0],
        };

        const commands = drawGlyphRun(
            glyphRun,
            mockSubset,
            0,
            0,
            12,
            { r: 1, g: 0, b: 0, a: 1 } // Red
        );

        const content = commands.join(" ");
        expect(content).toMatch(/1(?:\.0+)?\s+0(?:\.0+)?\s+0(?:\.0+)?\s+rg/);
    });

    it("normalizes 0-255 color inputs and applies fill alpha", () => {
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
            glyphIds: [0],
        };

        const gsm = new GraphicsStateManager();

        const commands = drawGlyphRun(
            glyphRun,
            mockSubset,
            0,
            0,
            12,
            { r: 51, g: 153, b: 255, a: 0.5 }, // 0-255 inputs with alpha
            gsm
        );

        const content = commands.join(" ");
        expect(content).toMatch(/\/GS0\s+gs/);
        expect(content).toMatch(/0\.2\s+0\.6\s+1\s+rg/);
    });

    it("encodes glyph ids via subset mapping (not Unicode code points)", () => {
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
                    [10, { advanceWidth: 500, leftSideBearing: 0 }],
                    [11, { advanceWidth: 400, leftSideBearing: 0 }],
                ]),
                cmap: {
                    getGlyphId: () => 0,
                    hasCodePoint: () => true,
                    unicodeMap: new Map(),
                },
            },
            program: {
                sourceFormat: "ttf",
                unitsPerEm: 1000,
                glyphCount: 12,
            },
        };

        const glyphRun: GlyphRun = {
            font: mockFont,
            glyphIds: [10, 11],
            positions: [{ x: 0, y: 0 }, { x: 500, y: 0 }],
            text: "Hi",
            fontSize: 12,
        };

        const mockSubset: PdfFontSubset = {
            name: "/F1",
            firstChar: 0,
            lastChar: 11,
            widths: [],
            toUnicodeCMap: "",
            fontFile: new Uint8Array(0),
            // Remap glyphs to arbitrary codes to ensure we don't use Unicode code points
            encodeGlyph: (gid) => gid + 200,
            glyphIds: [10, 11],
        };

        const commands = drawGlyphRun(
            glyphRun,
            mockSubset,
            0,
            0,
            12,
            { r: 0, g: 0, b: 0, a: 1 }
        );

        const tj = commands.find(c => c.includes("TJ")) ?? "";
        expect(tj).toContain("<00D2>"); // 10 + 200 -> 0x00D2
        expect(tj).toContain("<00D3>"); // 11 + 200 -> 0x00D3
        expect(tj).not.toContain("<0048>"); // Unicode 'H' should not appear
    });
});
