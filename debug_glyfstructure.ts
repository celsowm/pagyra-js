import { readFileSync } from 'fs';
import { resolve } from 'path';
import { readUInt16BE, readUInt32BE } from './src/compression/utils.js';

async function debugHeader() {
    const path = resolve('assets/fonts/woff2/caveat/Caveat-Regular.woff2');
    const buffer = readFileSync(path);

    // Need to manually decompress to get the transformed glyf data
    const { WOFF2Brotli } = await import('./src/compression/brotli/index.js');
    const { Woff2Parser } = await import('./src/fonts/parsers/woff2-parser.js');

    // Use low-level access to get table entries
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.length);
    let offset = 48;  // After WOFF2 header

    // Skip table directory to find compressed data
    for (let i = 0; i < 18; i++) {
        const flags = buffer[offset++];
        const tagValue = flags & 0x3F;

        if (tagValue === 63) offset += 4;  // Custom tag

        // Skip origLength (UIntBase128)
        for (let j = 0; j < 5; j++) {
            const byte = buffer[offset++];
            if ((byte & 0x80) === 0) break;
        }

        // Skip transformLength if present
        const transformVersion = (flags >> 6) & 0x03;
        if (transformVersion === 0) {
            for (let j = 0; j < 5; j++) {
                const byte = buffer[offset++];
                if ((byte & 0x80) === 0) break;
            }
        }
    }

    console.log(`Compressed data starts at offset: ${offset}`);

    // Decompress
    const compressedSize = view.getUint32(16, false);  // From WOFF2 header
    const compressed = buffer.subarray(offset, offset + compressedSize);

    console.log(`Decompressing ${compressed.length} bytes...`);
    const decompressed = await WOFF2Brotli.decompress(compressed);
    console.log(`Decompressed to ${decompressed.length} bytes`);

    // Now find the glyf table in the decompressed stream
    // Based on table order: FFTM, GDEF, GPOS, GSUB, OS/2, cmap, cvt, fpgm, gasp, glyf...
    const tableSizes = [28, 112, 29062, 20854, 96, 1158, 184, 3437, 8];  // Before glyf
    let glyfOffset = tableSizes.reduce((a, b) => a + b, 0);

    console.log(`\nGlyf table should start at offset ${glyfOffset} in decompressed stream`);
    console.log(`Glyf transformed size: 143491 bytes`);

    const glyfData = decompressed.subarray(glyfOffset, glyfOffset + 143491);

    // Parse header
    let pos = 0;
    const version = readUInt16BE(glyfData, pos); pos += 2;
    const optionFlags = readUInt16BE(glyfData, pos); pos += 2;
    const numGlyphs = readUInt16BE(glyfData, pos); pos += 2;
    const indexFormat = readUInt16BE(glyfData, pos); pos += 2;

    const nContourStreamSize = readUInt32BE(glyfData, pos); pos += 4;
    const nPointsStreamSize = readUInt32BE(glyfData, pos); pos += 4;
    const flagStreamSize = readUInt32BE(glyfData, pos); pos += 4;
    const glyphStreamSize = readUInt32BE(glyfData, pos); pos += 4;
    const compositeStreamSize = readUInt32BE(glyfData, pos); pos += 4;
    const bboxStreamSize = readUInt32BE(glyfData, pos); pos += 4;
    const instructionStreamSize = readUInt32BE(glyfData, pos); pos += 4;

    console.log(`\n=== Parsed Header ===`);
    console.log(`version: ${version}`);
    console.log(`optionFlags: ${optionFlags} (0b${optionFlags.toString(2).padStart(16, '0')})`);
    console.log(`numGlyphs: ${numGlyphs}`);
    console.log(`indexFormat: ${indexFormat}`);
    console.log(`n ContourStreamSize: ${nContourStreamSize}`);
    console.log(`nPointsStreamSize: ${nPointsStreamSize}`);
    console.log(`flagStreamSize: ${flagStreamSize}`);
    console.log(`glyphStreamSize: ${glyphStreamSize}`);
    console.log(`compositeStreamSize:${compositeStreamSize}`);
    console.log(`bboxStreamSize: ${bboxStreamSize}`);
    console.log(`instructionStreamSize: ${instructionStreamSize}`);
    console.log(`\nHeader size: 36 bytes`);
    console.log(`Current pos: ${pos}`);

    const totalStreamSize = nContourStreamSize + nPointsStreamSize + flagStreamSize +
        glyphStreamSize + compositeStreamSize + bboxStreamSize + instructionStreamSize;
    console.log(`\nTotal stream sizes: ${totalStreamSize} bytes`);
    console.log(`Available after header: ${glyfData.length - 36} bytes`);
    console.log(`Difference: ${(glyfData.length - 36) - totalStreamSize} bytes`);

    // This difference should be the bboxBitmap size (+optionFlags)
    const bboxBitmapSize = 4 * Math.floor((numGlyphs + 31) / 32);
    console.log(`\nExpected bboxBitmap size: ${bboxBitmapSize} bytes`);

    const overlapBitmapSize = (optionFlags & 1) !== 0 ? Math.floor((numGlyphs + 7) / 8) : 0;
    console.log(`overlapSimpleBitmap size: ${overlapBitmapSize} bytes`);

    console.log(`\nNext 100 bytes after header:`);
    const next100 = [];
    for (let i = 0; i < 100 && (pos + i) < glyfData.length; i++) {
        next100.push(glyfData[pos + i].toString(16).padStart(2, '0'));
    }
    console.log(next100.join(' '));
}

debugHeader().catch(console.error);
