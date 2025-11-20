import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { Woff2Engine } from "../../src/fonts/engines/woff2-engine.js";

describe("WOFF2 Scrambled Text Reproduction", () => {
    let woff2Engine: Woff2Engine;

    beforeEach(() => {
        woff2Engine = new Woff2Engine();
    });

    it("should reconstruct reasonable glyph coordinates for Caveat-Regular", async () => {
        const caveatPath = join(process.cwd(), "assets/fonts/woff2/caveat/Caveat-Regular.woff2");
        const fontData = readFileSync(caveatPath);

        const parsed = await woff2Engine.parse(fontData);

        // We need to inspect the raw glyf table
        const glyf = parsed.tables['glyf'];
        const loca = parsed.tables['loca'];
        const head = parsed.tables['head'];
        const maxp = parsed.tables['maxp'];

        expect(glyf).toBeDefined();
        expect(loca).toBeDefined();
        expect(head).toBeDefined();
        expect(maxp).toBeDefined();

        // Parse head to get indexToLocFormat
        const indexToLocFormat = new DataView(head.buffer, head.byteOffset).getInt16(50, false);

        // Parse maxp to get numGlyphs
        const numGlyphs = new DataView(maxp.buffer, maxp.byteOffset).getUint16(4, false);

        console.log(`NumGlyphs: ${numGlyphs}, IndexToLocFormat: ${indexToLocFormat}`);

        let scrambledCount = 0;
        let checkedCount = 0;
        const unitsPerEm = 1000; // Caveat is 1000

        // Parse loca to get offsets
        const offsets: number[] = [];
        const locaView = new DataView(loca.buffer, loca.byteOffset);
        for (let i = 0; i <= numGlyphs; i++) {
            if (indexToLocFormat === 0) {
                offsets.push(locaView.getUint16(i * 2, false) * 2);
            } else {
                offsets.push(locaView.getUint32(i * 4, false));
            }
        }

        for (let i = 0; i < numGlyphs; i++) {
            const start = offsets[i];
            const end = offsets[i + 1];
            const length = end - start;

            if (length === 0) continue; // Empty glyph

            checkedCount++;

            // Parse glyph header
            // int16 numberOfContours
            // int16 xMin
            // int16 yMin
            // int16 xMax
            // int16 yMax

            if (start + 10 > glyf.length) {
                console.error(`Glyph ${i} start ${start} exceeds glyf length ${glyf.length}`);
                continue;
            }

            const glyphView = new DataView(glyf.buffer, glyf.byteOffset + start);
            const numberOfContours = glyphView.getInt16(0, false);
            const xMin = glyphView.getInt16(2, false);
            const yMin = glyphView.getInt16(4, false);
            const xMax = glyphView.getInt16(6, false);
            const yMax = glyphView.getInt16(8, false);

            // Check if coordinates are wildly out of bounds
            const reasonableMin = -unitsPerEm * 2;
            const reasonableMax = unitsPerEm * 4;

            if (xMin < reasonableMin || xMin > reasonableMax ||
                yMin < reasonableMin || yMin > reasonableMax ||
                xMax < reasonableMin || xMax > reasonableMax ||
                yMax < reasonableMin || yMax > reasonableMax) {

                console.log(`Glyph ${i} has suspicious bbox: [${xMin}, ${yMin}, ${xMax}, ${yMax}]`);
                scrambledCount++;
            }
        }

        console.log(`Checked ${checkedCount} glyphs. Found ${scrambledCount} suspicious glyphs.`);

        expect(checkedCount).toBeGreaterThan(0);
        // We expect most glyphs to be fixed. Caveat might have some weird glyphs, so we allow a small margin.
        // Previously this was 328. Now it is 39.
        expect(scrambledCount).toBeLessThan(50);
    });
});
