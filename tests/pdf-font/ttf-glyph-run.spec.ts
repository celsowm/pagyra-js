import { describe, it, expect } from "vitest";
import type { GlyphRun } from "../../src/layout/text-run.js";
import { PdfFontRegistry } from "../../src/pdf/font-subset/font-registry.js";
import { createPdfFontSubset } from "../../src/pdf/font/font-subset.js";
import type { UnifiedFont } from "../../src/fonts/types.js";


describe("TTF GlyphRun Path", () => {
    it("should create a GlyphRun from text", () => {
        // Create a minimal mock UnifiedFont
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
                    [0, { advanceWidth: 500, leftSideBearing: 0 }], // .notdef
                    [1, { advanceWidth: 600, leftSideBearing: 50 }], // 'H'
                    [2, { advanceWidth: 250, leftSideBearing: 50 }], // 'i'
                ]),
                cmap: {
                    getGlyphId: (cp: number) => {
                        if (cp === 72) return 1; // 'H'
                        if (cp === 105) return 2; // 'i'
                        return 0; // .notdef
                    },
                    hasCodePoint: () => true,
                    unicodeMap: new Map([
                        [72, 1],  // 'H' -> gid 1
                        [105, 2], // 'i' -> gid 2
                    ]),
                },
            },
            program: {
                sourceFormat: "ttf",
                unitsPerEm: 1000,
                glyphCount: 3,
            },
            css: {
                family: "TestFont",
                weight: 400,
                style: "normal",
            },
        };

        const glyphRun: GlyphRun = {
            font: mockFont,
            glyphIds: [1, 2], // 'Hi'
            positions: [
                { x: 0, y: 0 },
                { x: 600, y: 0 },
            ],
            text: "Hi",
            fontSize: 12,
        };

        expect(glyphRun.glyphIds).toEqual([1, 2]);
        expect(glyphRun.text).toBe("Hi");
        expect(glyphRun.font.css?.family).toBe("TestFont");
    });

    it("should register glyph usage in PdfFontRegistry", () => {
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
                    unicodeMap: new Map([
                        [72, 1],
                        [105, 2],
                    ]),
                },
            },
            program: {
                sourceFormat: "ttf",
                unitsPerEm: 1000,
                glyphCount: 3,
            },
            css: {
                family: "TestFont",
                weight: 400,
                style: "normal",
            },
        };

        const registry = new PdfFontRegistry();
        const glyphRun: GlyphRun = {
            font: mockFont,
            glyphIds: [1, 2],
            positions: [{ x: 0, y: 0 }, { x: 600, y: 0 }],
            text: "Hi",
            fontSize: 12,
        };

        registry.registerGlyphRun(glyphRun);

        const handle = registry.ensureSubsetFor(mockFont);

        expect(handle.subset).toBeDefined();
        expect(handle.subset.name).toBe("/F1");
        expect(handle.unifiedFont).toBe(mockFont);
    });

    it("should create a PdfFontSubset with correct widths", () => {
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
                    [0, { advanceWidth: 500, leftSideBearing: 0 }], // .notdef
                    [1, { advanceWidth: 600, leftSideBearing: 50 }], // gid 1
                    [2, { advanceWidth: 250, leftSideBearing: 50 }], // gid 2
                ]),
                cmap: {
                    getGlyphId: () => 0,
                    hasCodePoint: () => true,
                    unicodeMap: new Map([
                        [72, 1],  // 'H'
                        [105, 2], // 'i'
                    ]),
                },
            },
            program: {
                sourceFormat: "ttf",
                unitsPerEm: 1000,
                glyphCount: 3,
            },
        };

        const subset = createPdfFontSubset({
            baseName: "F1",
            fontMetrics: mockFont.metrics,
            fontProgram: mockFont.program,
            usedGlyphIds: new Set([0, 1, 2]),
        });

        expect(subset.name).toBe("/F1");
        expect(subset.firstChar).toBe(0);
        expect(subset.lastChar).toBe(2);
        expect(subset.widths).toEqual([500, 600, 250]); // scaled to PDF units
        expect(subset.encodeGlyph(0)).toBe(0);
        expect(subset.encodeGlyph(1)).toBe(1);
        expect(subset.encodeGlyph(2)).toBe(2);
    });

    it("should generate ToUnicode CMap", () => {
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
                ]),
                cmap: {
                    getGlyphId: () => 0,
                    hasCodePoint: () => true,
                    unicodeMap: new Map([
                        [72, 1], // 'H' -> gid 1
                    ]),
                },
            },
            program: {
                sourceFormat: "ttf",
                unitsPerEm: 1000,
                glyphCount: 2,
            },
        };

        const subset = createPdfFontSubset({
            baseName: "F1",
            fontMetrics: mockFont.metrics,
            fontProgram: mockFont.program,
            usedGlyphIds: new Set([0, 1]),
        });

        const cmap = subset.toUnicodeCMap;

        expect(cmap).toContain("begincmap");
        expect(cmap).toContain("endcmap");
        expect(cmap).toContain("0048"); // 'H' in hex
    });

    it("keeps identity encoding for non-contiguous glyph ids", () => {
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
                    [0, { advanceWidth: 400, leftSideBearing: 0 }],
                    [5, { advanceWidth: 500, leftSideBearing: 0 }],
                    [9, { advanceWidth: 450, leftSideBearing: 0 }],
                ]),
                cmap: {
                    getGlyphId: () => 0,
                    hasCodePoint: () => true,
                    unicodeMap: new Map([
                        [0x41, 5],
                        [0x42, 9],
                    ]),
                },
            },
            program: {
                sourceFormat: "ttf",
                unitsPerEm: 1000,
                glyphCount: 10,
            },
            css: {
                family: "TestFont",
                weight: 400,
                style: "normal",
            },
        };

        const subset = createPdfFontSubset({
            baseName: "F10",
            fontMetrics: mockFont.metrics,
            fontProgram: mockFont.program,
            usedGlyphIds: new Set([0, 5, 9]),
        });

        expect(subset.glyphIds).toEqual([0, 5, 9]);
        expect(subset.firstChar).toBe(0);
        expect(subset.lastChar).toBe(9);
        expect(subset.encodeGlyph(5)).toBe(5);
        expect(subset.encodeGlyph(9)).toBe(9);
        expect(subset.toUnicodeCMap).toContain("<0005>");
        expect(subset.toUnicodeCMap).toContain("<0009>");
    });

    it("refreshes subsets when new glyphs are registered later", () => {
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
                    [0, { advanceWidth: 400, leftSideBearing: 0 }],
                    [5, { advanceWidth: 500, leftSideBearing: 0 }],
                    [9, { advanceWidth: 450, leftSideBearing: 0 }],
                ]),
                cmap: {
                    getGlyphId: () => 0,
                    hasCodePoint: () => true,
                    unicodeMap: new Map([
                        [0x41, 5],
                        [0x42, 9],
                    ]),
                },
            },
            program: {
                sourceFormat: "ttf",
                unitsPerEm: 1000,
                glyphCount: 10,
            },
            css: {
                family: "TestFont",
                weight: 400,
                style: "normal",
            },
        };

        const registry = new PdfFontRegistry();
        const firstRun: GlyphRun = {
            font: mockFont,
            glyphIds: [5],
            positions: [{ x: 0, y: 0 }],
            text: "A",
            fontSize: 12,
        };
        registry.registerGlyphRun(firstRun);
        const firstHandle = registry.ensureSubsetFor(mockFont);
        expect(firstHandle.subset.glyphIds).toEqual([0, 5]);

        const secondRun: GlyphRun = {
            font: mockFont,
            glyphIds: [9],
            positions: [{ x: 0, y: 0 }],
            text: "B",
            fontSize: 12,
        };
        registry.registerGlyphRun(secondRun);
        const refreshed = registry.ensureSubsetFor(mockFont);

        expect(refreshed.subset.name).toBe(firstHandle.subset.name);
        expect(refreshed.subset.glyphIds).toEqual([0, 5, 9]);
        expect(() => refreshed.subset.encodeGlyph(9)).not.toThrow();
    });
});
