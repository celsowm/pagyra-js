
import { readFileSync } from 'fs';
import { Woff2Parser } from './src/fonts/parsers/woff2-parser.js';
import { CmapParser } from './src/pdf/font/ttf-cmap.js';
import { resolve } from 'path';

async function run() {
    try {
        console.log('Starting inspection...');
        const path = resolve('assets/fonts/woff2/caveat/Caveat-Regular.woff2');
        console.log(`Reading file from ${path}`);
        const buffer = readFileSync(path);
        console.log(`File read, size: ${buffer.length}`);

        const parser = new Woff2Parser();
        console.log('Parsing tables...');

        // Add timeout race
        const parsePromise = parser.parseTables(buffer);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout parsing tables')), 5000));

        const result = await Promise.race([parsePromise, timeoutPromise]) as any;
        console.log('Tables parsed successfully');

        const cmapData = result.tables['cmap'];
        const maxpData = result.tables['maxp'];
        const headData = result.tables['head'];
        const glyfData = result.tables['glyf'];
        const locaData = result.tables['loca'];

        if (maxpData) {
            const numGlyphs = new DataView(maxpData.buffer, maxpData.byteOffset).getUint16(4, false);
            console.log(`NumGlyphs (from maxp): ${numGlyphs}`);
        }
        if (headData) {
            const indexToLocFormat = new DataView(headData.buffer, headData.byteOffset).getInt16(50, false);
            console.log(`IndexToLocFormat (from head): ${indexToLocFormat}`);
        }
        if (glyfData) {
            console.log(`Glyf table size: ${glyfData.length}`);
        }
        if (locaData) {
            console.log(`Loca table size: ${locaData.length}`);
        }

        if (!cmapData) {
            console.error('No cmap table found');
            console.log('Available tables:', Object.keys(result.tables).join(', '));
            process.exit(1);
        }

        console.log('Parsing cmap table...');
        const cmapParser = new CmapParser(null as any, new DataView(cmapData.buffer, cmapData.byteOffset, cmapData.length));

        // Check specific characters
        const chars = ['C', 'a', 'v', 'e', 't', ' ', '1', '2', '3'];
        console.log('Mappings & Metrics:');

        const hmtxView = result.tables['hmtx'] ? new DataView(result.tables['hmtx'].buffer, result.tables['hmtx'].byteOffset, result.tables['hmtx'].length) : null;
        const locaView = result.tables['loca'] ? new DataView(result.tables['loca'].buffer, result.tables['loca'].byteOffset, result.tables['loca'].length) : null;
        const glyfView = result.tables['glyf'] ? new DataView(result.tables['glyf'].buffer, result.tables['glyf'].byteOffset, result.tables['glyf'].length) : null;
        const indexToLocFormat = headData ? new DataView(headData.buffer, headData.byteOffset).getInt16(50, false) : 0;

        for (const char of chars) {
            const code = char.codePointAt(0)!;
            const gid = cmapParser.getGlyphId(code);

            let width = -1;
            let lsb = -1;
            if (hmtxView) {
                // Assuming numberOfHMetrics == numGlyphs for simplicity (checked earlier)
                width = hmtxView.getUint16(gid * 4, false);
                lsb = hmtxView.getInt16(gid * 4 + 2, false);
            }

            let bbox = 'N/A';
            let glyphLen = -1;
            if (locaView && glyfView) {
                let offset, nextOffset;
                if (indexToLocFormat === 1) {
                    offset = locaView.getUint32(gid * 4, false);
                    nextOffset = locaView.getUint32((gid + 1) * 4, false);
                } else {
                    offset = locaView.getUint16(gid * 2, false) * 2;
                    nextOffset = locaView.getUint16((gid + 1) * 2, false) * 2;
                }

                glyphLen = nextOffset - offset;
                if (glyphLen > 0 && offset + 10 <= glyfView.byteLength) {
                    const numberOfContours = glyfView.getInt16(offset, false);
                    const xMin = glyfView.getInt16(offset + 2, false);
                    const yMin = glyfView.getInt16(offset + 4, false);
                    const xMax = glyfView.getInt16(offset + 6, false);
                    const yMax = glyfView.getInt16(offset + 8, false);
                    bbox = `[${xMin}, ${yMin}, ${xMax}, ${yMax}] (nContours: ${numberOfContours})`;
                } else if (glyphLen === 0) {
                    bbox = 'Empty';
                } else {
                    bbox = 'Invalid Offset/Len';
                }
            }

            console.log(`'${char}' (${code}) -> GID ${gid}, Width: ${width}, LSB: ${lsb}, Len: ${glyphLen}, BBox: ${bbox}`);
        }

    } catch (e) {
        console.error('Error during inspection:', e);
    }
}

run();
