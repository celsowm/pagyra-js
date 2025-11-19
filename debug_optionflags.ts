import { readFileSync } from 'fs';
import { resolve } from 'path';
import { readUInt16BE } from './src/compression/utils.js';

async function run() {
    const path = resolve('assets/fonts/woff2/caveat/Caveat-Regular.woff2');
    const buffer = readFileSync(path);

    const { Woff2Parser } = await import('./src/fonts/parsers/woff2-parser.js');
    const parser = new Woff2Parser();
    const tables = await parser.parseTables(buffer) as any;

    const glyfData = tables.tables['glyf'];  // This is the transformed data before reconstruction

    console.log('Transformed glyf data (first 100 bytes as hex):');
    const first100 = [];
    for (let i = 0; i < Math.min(100, glyfData.length); i++) {
        first100.push(glyfData[i].toString(16).padStart(2, '0'));
    }
    console.log(first100.join(' '));

    // Parse header manually
    let offset = 0;
    const version = readUInt16BE(glyfData, offset);
    offset += 2;
    const optionFlags = readUInt16BE(glyfData, offset);
    offset += 2;
    const numGlyphs = readUInt16BE(glyfData, offset);
    offset += 2;
    const indexFormat = readUInt16BE(glyfData, offset);
    offset += 2;

    console.log(`\nHeader: version=${version}, optionFlags=${optionFlags} (0b${optionFlags.toString(2)}), numGlyphs=${numGlyphs}, indexFormat=${indexFormat}`);
    console.log(`optionFlags bit 0 (overlapSimpleBitmap present): ${(optionFlags & 1) !== 0}`);

    // Check if we need to skip overlapSimpleBitmap
    if ((optionFlags & 1) !== 0) {
        const overlapBitmapSize = Math.floor((numGlyphs + 7) / 8);  // 1 bit per glyph
        console.log(`overlapSimpleBitmap size: ${overlapBitmapSize} bytes`);
        console.log(`Should skip ${overlapBitmapSize} bytes before bboxBitmap`);
    }

    const bboxBitmapSize = 4 * Math.floor((numGlyphs + 31) / 32);
    console.log(`bboxBitmap size: ${bboxBitmapSize} bytes`);
}

run().catch(console.error);
