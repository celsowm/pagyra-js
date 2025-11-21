import { describe, it, expect } from "vitest";
import type { UnifiedFont } from "../../src/fonts/types.js";
import type { GlyphRun } from "../../src/layout/text-run.js";
import { PdfFontRegistry } from "../../src/pdf/font-subset/font-registry.js";
import { drawGlyphRun } from "../../src/pdf/utils/glyph-run-renderer.js";

describe("End-to-End TTF GlyphRun Pipeline", () => {
    it("should complete the full pipeline: text → GlyphRun → PDF subset → rendering", () => {
        // 1. Create a mock TTF font
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
                    [0, { advanceWidth: 500, leftSideBearing: 0 }],   // .notdef
                    [1, { advanceWidth: 600, leftSideBearing: 50 }],  // 'H' (U+0048)
                    [2, { advanceWidth: 250, leftSideBearing: 50 }],  // 'e' (U+0065)
                    [3, { advanceWidth: 300, leftSideBearing: 40 }],  // 'l' (U+006C)
                    [4, { advanceWidth: 300, leftSideBearing: 40 }],  // 'o' (U+006F)
                ]),
                cmap: {
                    getGlyphId: (cp: number) => {
                        const map: Record<number, number> = {
                            0x48: 1,  // 'H'
                            0x65: 2,  // 'e'
                            0x6C: 3,  // 'l'
                            0x6F: 4,  // 'o'
                        };
                        return map[cp] ?? 0;
                    },
                    hasCodePoint: (cp: number) => {
                        return [0x48, 0x65, 0x6C, 0x6F].includes(cp);
                    },
                    unicodeMap: new Map([
                        [0x48, 1],  // 'H'
                        [0x65, 2],  // 'e'
                        [0x6C, 3],  // 'l'
                        [0x6F, 4],  // 'o'
                    ]),
                },
            },
            program: {
                sourceFormat: "ttf",
                unitsPerEm: 1000,
                glyphCount: 5,
            },
            css: {
                family: "TestFont",
                weight: 400,
                style: "normal",
            },
        };

        // 2. Create GlyphRun from text "Hello"
        const text = "Hello";
        const glyphIds: number[] = [];
        const positions: { x: number; y: number }[] = [];
        let currentX = 0;

        for (const char of text) {
            const codePoint = char.codePointAt(0)!;
            const gid = mockFont.metrics.cmap.getGlyphId(codePoint);
            glyphIds.push(gid);

            const glyphMetric = mockFont.metrics.glyphMetrics.get(gid);
            const advanceWidth = glyphMetric?.advanceWidth ?? 0;
            const fontSize = 12;
            const scaledAdvance = (advanceWidth / mockFont.metrics.metrics.unitsPerEm) * fontSize;

            positions.push({ x: currentX, y: 0 });
            currentX += scaledAdvance;
        }

        const glyphRun: GlyphRun = {
            font: mockFont,
            glyphIds,
            positions,
            text,
            fontSize: 12,
            width: currentX,
        };

        // 3. Register GlyphRun with PdfFontRegistry
        const registry = new PdfFontRegistry();
        registry.registerGlyphRun(glyphRun);

        // 4. Get the font subset
        const handle = registry.ensureSubsetFor(mockFont);
        const subset = handle.subset;

        // 5. Verify subset properties
        expect(subset.name).toBe("/F1");
        expect(subset.firstChar).toBe(0);
        expect(subset.lastChar).toBe(4);
        expect(subset.widths).toHaveLength(5);

        // Widths should be in PDF units (1/1000 of font size)
        expect(subset.widths[0]).toBe(500); // .notdef
        expect(subset.widths[1]).toBe(600); // 'H'
        expect(subset.widths[2]).toBe(250); // 'e'
        expect(subset.widths[3]).toBe(300); // 'l'
        expect(subset.widths[4]).toBe(300); // 'o'

        // 6. Verify ToUnicode CMap
        expect(subset.toUnicodeCMap).toContain("begincmap");
        expect(subset.toUnicodeCMap).toContain("0048"); // 'H'
        expect(subset.toUnicodeCMap).toContain("0065"); // 'e'
        expect(subset.toUnicodeCMap).toContain("006C"); // 'l'
        expect(subset.toUnicodeCMap).toContain("006F"); // 'o'

        // 7. Generate PDF commands
        const commands = drawGlyphRun(
            glyphRun,
            subset,
            100, // x position
            200, // y position
            12,  // font size
            { r: 0, g: 0, b: 0, a: 1 }
        );

        // 8. Verify PDF commands
        expect(commands).toContain("BT");
        expect(commands).toContain("/F1 12.00 Tf");
        expect(commands).toContain("100.00 200.00 Td");

        // Log actual commands for debugging
        console.log("Generated commands:", commands);

        // Verify glyph encoding: UTF-16BE for "Hello" (0048 0065 006C 006C 006F)
        const hexCommand = commands.find(cmd => cmd.includes("Tj"));
        console.log("Hex command:", hexCommand);
        expect(hexCommand).toBeDefined();
        expect(hexCommand).toContain("<00480065006C006C006F> Tj");

        expect(commands).toContain("ET");

        // 9. Verify glyph ID consistency
        // The same glyph IDs chosen during layout (1,2,3,3,4)
        // should be encoded in the PDF content stream
        for (let i = 0; i < glyphRun.glyphIds.length; i++) {
            const gid = glyphRun.glyphIds[i];
            const charCode = subset.encodeGlyph(gid);
            expect(charCode).toBe(gid); // In our simple case, they're 1:1
        }

        console.log("✅ End-to-end pipeline complete:");
        console.log(`   Text: "${text}"`);
        console.log(`   Glyph IDs: [${glyphIds.join(", ")}]`);
        console.log(`   Subset: ${subset.name}`);
        console.log(`   PDF commands: ${commands.length} commands generated`);
    });
});
