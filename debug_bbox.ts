import { readFileSync } from 'fs';
import { Woff2Parser } from './src/fonts/parsers/woff2-parser.js';
import { resolve } from 'path';
import { readUInt16BE, readUInt32BE } from './src/compression/utils.js';

async function run() {
    try {
        const path = resolve('assets/fonts/woff2/caveat/Caveat-Regular.woff2');
        const buffer = readFileSync(path);
        const parser = new Woff2Parser();

        const result = await parser.parseTables(buffer) as any;

        const glyfData = result.tables['glyf'];
        const maxpData = result.tables['maxp'];
        const headData = result.tables['head'];

        const numGlyphs = new DataView(maxpData.buffer, maxpData.byteOffset).getUint16(4, false);
        const indexFormat = new DataView(headData.buffer, headData.byteOffset).getInt16(50, false);

        console.log(`NumGlyphs: ${numGlyphs}, IndexFormat: ${indexFormat}`);
        console.log(`Transformed glyf data size: ${glyfData.length} bytes`);

        // Parse transformation header manually
        let offset = 0;
        const version = readUInt32BE(glyfData, offset);
        offset += 4;

        const numGlyphsInData = readUInt16BE(glyfData, offset);
        offset += 2;

        const indexFormatInData = readUInt16BE(glyfData, offset);
        offset += 2;

        const nContourStreamSize = readUInt32BE(glyfData, offset);
        offset += 4;

        const nPointsStreamSize = readUInt32BE(glyfData, offset);
        offset += 4;

        const flagStreamSize = readUInt32BE(glyfData, offset);
        offset += 4;

        const glyphStreamSize = readUInt32BE(glyfData, offset);
        offset += 4;

        const compositeStreamSize = readUInt32BE(glyfData, offset);
        offset += 4;

        const bboxStreamSize = readUInt32BE(glyfData, offset);
        offset += 4;

        const instructionStreamSize = readUInt32BE(glyfData, offset);
        offset += 4;

        console.log('\n=== Transform Header ===');
        console.log(`Version: 0x${version.toString(16)}`);
        console.log(`NumGlyphs in data: ${numGlyphsInData}`);
        console.log(`IndexFormat in data: ${indexFormatInData}`);
        console.log(`nContourStreamSize: ${nContourStreamSize}`);
        console.log(`nPointsStreamSize: ${nPointsStreamSize}`);
        console.log(`flagStreamSize: ${flagStreamSize}`);
        console.log(`glyphStreamSize: ${glyphStreamSize}`);
        console.log(`compositeStreamSize: ${compositeStreamSize}`);
        console.log(`bboxStreamSize: ${bboxStreamSize}`);
        console.log(`instructionStreamSize: ${instructionStreamSize}`);

        // Calculate expected bbox stream size
        // Each bbox is 8 bytes (4 x int16)
        // But only for non-empty glyphs
        console.log(`\nExpected bbox entries (if all non-empty): ${numGlyphs * 8} bytes`);

        // Parse nContour stream to count non-empty glyphs
        const headerSize = 36;
        let nContourOffset = headerSize;
        const nContourStream = glyfData;

        let nonEmptyGlyphs = 0;
        for (let i = 0; i < numGlyphs; i++) {
            const nContours = readUInt16BE(nContourStream, nContourOffset);
            const signed = nContours > 0x7FFF ? nContours - 0x10000 : nContours;
            nContourOffset += 2;
            if (signed !== 0) {
                nonEmptyGlyphs++;
            }
        }

        console.log(`Non-empty glyphs: ${nonEmptyGlyphs}`);
        console.log(`Expected bbox stream size: ${nonEmptyGlyphs * 8} bytes`);
        console.log(`Actual bbox stream size: ${bboxStreamSize} bytes`);
        console.log(`Difference: ${bboxStreamSize - (nonEmptyGlyphs * 8)} bytes`);

        // Now examine the bbox stream directly
        const bboxOffset = headerSize + nContourStreamSize + nPointsStreamSize + flagStreamSize + glyphStreamSize + compositeStreamSize;
        console.log(`\n=== BBox Stream Analysis ===`);
        console.log(`BBox stream starts at offset: ${bboxOffset}`);
        console.log(`First 40 bytes of bbox stream (hex):`);

        const bboxBytes = [];
        for (let i = 0; i < Math.min(40, bboxStreamSize); i++) {
            bboxBytes.push(glyfData[bboxOffset + i].toString(16).padStart(2, '0'));
        }
        console.log(bboxBytes.join(' '));

        // Read first few bboxes
        console.log(`\nFirst 10 bboxes (int16 big-endian):`);
        let bboxPos = bboxOffset;
        for (let i = 0; i < 10 && bboxPos + 8 <= bboxOffset + bboxStreamSize; i++) {
            const xMin = readUInt16BE(glyfData, bboxPos);
            const xMinSigned = xMin > 0x7FFF ? xMin - 0x10000 : xMin;
            bboxPos += 2;

            const yMin = readUInt16BE(glyfData, bboxPos);
            const yMinSigned = yMin > 0x7FFF ? yMin - 0x10000 : yMin;
            bboxPos += 2;

            const xMax = readUInt16BE(glyfData, bboxPos);
            const xMaxSigned = xMax > 0x7FFF ? xMax - 0x10000 : xMax;
            bboxPos += 2;

            const yMax = readUInt16BE(glyfData, bboxPos);
            const yMaxSigned = yMax > 0x7FFF ? yMax - 0x10000 : yMax;
            bboxPos += 2;

            console.log(`BBox ${i}: [${xMinSigned}, ${yMinSigned}, ${xMaxSigned}, ${yMaxSigned}]`);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
