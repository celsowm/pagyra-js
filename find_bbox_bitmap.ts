import { readFileSync } from 'fs';
import { resolve } from 'path';
import { readUInt16BE, readUInt32BE } from './src/compression/utils.js';

async function run() {
    const path = resolve('assets/fonts/woff2/caveat/Caveat-Regular.woff2');
    const buffer = readFileSync(path);

    const { WOFF2Brotli } = await import('./src/compression/brotli/index.js');

    // Decompress to get full stream
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.length);
    const compressedSize = view.getUint32(16, false);
    const compressed = buffer.subarray(106, 106 + compressedSize);

    const decompressed = await WOFF2Brotli.decompress(compressed);

    // Glyf starts at offset 54939
    const tableSizes = [28, 112, 29062, 20854, 96, 1158, 184, 3437, 8];
    const glyfOffset = tableSizes.reduce((a, b) => a + b, 0);
    const glyfData = decompressed.subarray(glyfOffset, glyfOffset + 143491);

    console.log('=== Checking for bboxBitmap in data ===');
    console.log(`Total glyf data: ${glyfData.length} bytes`);

    // Parse header
    let pos = 0;
    const version = readUInt16BE(glyfData, pos); pos += 2;
    const optionFlags = readUInt16BE(glyfData, pos); pos += 2;
    const numGlyphs = readUInt16BE(glyfData, pos); pos += 2;
    const indexFormat = readUInt16BE(glyfData, pos); pos += 2;

    // Read all stream sizes
    const nContourStreamSize = readUInt32BE(glyfData, pos); pos += 4;
    const nPointsStreamSize = readUInt32BE(glyfData, pos); pos += 4;
    const flagStreamSize = readUInt32BE(glyfData, pos); pos += 4;
    const glyphStreamSize = readUInt32BE(glyfData, pos); pos += 4;
    const compositeStreamSize = readUInt32BE(glyfData, pos); pos += 4;
    const bboxStreamSize = readUInt32BE(glyfData, pos); pos += 4;
    const instructionStreamSize = readUInt32BE(glyfData, pos); pos += 4;

    console.log(`Header ends at byte: ${pos}`);
    console.log(`bboxBitmapSize should be: ${4 * Math.floor((numGlyphs + 31) / 32)} bytes`);

    // Try to find a 92-byte section that looks like a bitmap
    console.log(`\nSearching for potential bboxBitmap...`);

    // Check if bytes 36-128 could be bitmap
    console.log(`\nBytes 36-128 (potential bitmap location):`);
    const potential = [];
    for (let i = 36; i < Math.min(128, glyfData.length); i++) {
        potential.push(glyfData[i].toString(16).padStart(2, '0'));
    }
    console.log(potential.join(' '));

    // Count set bits in this range to see if it makes sense
    let setBits = 0;
    for (let i = 36; i < 128 && i < glyfData.length; i++) {
        for (let bit = 0; bit < 8; bit++) {
            if (glyfData[i] & (1 << bit)) setBits++;
        }
    }
    console.log(`\nSet bits in bytes 36-128: ${setBits} (out of ${92 * 8} = ${736} possible)`);
    console.log(`Expected set bits (non-empty glyphs with bbox): ~332-400`);

    // Now check bytes at END of data
    console.log(`\nLast 100 bytes of transformed glyf data:`);
    const lastBytes = [];
    for (let i = Math.max(0, glyfData.length - 100); i < glyfData.length; i++) {
        lastBytes.push(glyfData[i].toString(16).padStart(2, '0'));
    }
    console.log(lastBytes.join(' '));
}

run().catch(console.error);
