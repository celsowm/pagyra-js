import { readFileSync } from 'fs';
import { Woff2Parser } from './src/fonts/parsers/woff2-parser.js';
import { CmapParser } from './src/pdf/font/ttf-cmap.js';
import { resolve } from 'path';

async function run() {
    const path = resolve('assets/fonts/woff2/caveat/Caveat-Regular.woff2');
    const buffer = readFileSync(path);

    const parser = new Woff2Parser();
    const result = await parser.parseTables(buffer) as any;

    const glyfView = result.tables['glyf'] ? new DataView(result.tables['glyf'].buffer, result.tables['glyf'].byteOffset, result.tables['glyf'].length) : null;
    const locaView = result.tables['loca'] ? new DataView(result.tables['loca'].buffer, result.tables['loca'].byteOffset, result.tables['loca'].length) : null;
    const headData = result.tables['head'];
    const indexToLocFormat = headData ? new DataView(headData.buffer, headData.byteOffset).getInt16(50, false) : 0;
    const unitsPerEm = headData ? new DataView(headData.buffer, headData.byteOffset).getUint16(18, false) : 1000;

    console.log(`Units per Em: ${unitsPerEm}`);
    console.log(`Index to Loc Format: ${indexToLocFormat}`);

    // Check a few glyphs
    const testGlyphs = [39, 69, 90];  // C, a, v
    const glyphNames = ['C', 'a', 'v'];

    for (let i = 0; i < testGlyphs.length; i++) {
        const gid = testGlyphs[i];
        const name = glyphNames[i];

        if (!locaView || !glyfView) continue;

        let offset, nextOffset;
        if (indexToLocFormat === 1) {
            offset = locaView.getUint32(gid * 4, false);
            nextOffset = locaView.getUint32((gid + 1) * 4, false);
        } else {
            offset = locaView.getUint16(gid * 2, false) * 2;
            nextOffset = locaView.getUint16((gid + 1) * 2, false) * 2;
        }

        const glyphLen = nextOffset - offset;

        if (glyphLen > 0 && offset + 10 <= glyfView.byteLength) {
            const nContours = glyfView.getInt16(offset, false);
            const xMin = glyfView.getInt16(offset + 2, false);
            const yMin = glyfView.getInt16(offset + 4, false);
            const xMax = glyfView.getInt16(offset + 6, false);
            const yMax = glyfView.getInt16(offset + 8, false);

            console.log(`\n'${name}' (GID ${gid}):`);
            console.log(`  nContours: ${nContours}`);
            console.log(`  BBox: [${xMin}, ${yMin}, ${xMax}, ${yMax}]`);
            console.log(`  BBox width: ${xMax - xMin}, height: ${yMax - yMin}`);
            console.log(`  Scaled to 1000 UPM: [${Math.round(xMin * 1000 / unitsPerEm)}, ${Math.round(yMin * 1000 / unitsPerEm)}, ${Math.round(xMax * 1000 / unitsPerEm)}, ${Math.round(yMax * 1000 / unitsPerEm)}]`);

            // Check if bbox looks reasonable
            if (xMax < xMin || yMax < yMin) {
                console.log(`  ⚠️  WARNING: Invalid bbox (max < min)`);
            }
            if (xMax - xMin > unitsPerEm * 2 || yMax - yMin > unitsPerEm * 2) {
                console.log(`  ⚠️  WARNING: BBox larger than 2x unitsPerEm`);
            }
        }
    }

    // Also test against reference TTF if available
    try {
        const ttfPath = resolve('assets/fonts/ttf/caveat/Caveat-Regular.ttf');
        const ttfBuffer = readFileSync(ttfPath);
        console.log('\n=== Comparing with reference TTF ===');
        // Would need TTF parser here
    } catch (e) {
        console.log('\n(No reference TTF available for comparison)');
    }
}

run().catch(console.error);
