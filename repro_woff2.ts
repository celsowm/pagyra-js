
import { readFileSync } from 'fs';
import { Woff2Parser } from './src/fonts/parsers/woff2-parser.js';
import { resolve } from 'path';

async function run() {
    try {
        console.log('Reading font file...');
        const path = resolve('assets/fonts/woff2/caveat/Caveat-Regular.woff2');
        const buffer = readFileSync(path);

        console.log('Parsing font...');
        const parser = new Woff2Parser();
        const result = await parser.parseTables(buffer);

        const glyf = result.tables['glyf'];
        const loca = result.tables['loca'];
        const head = result.tables['head'];

        if (!glyf || !loca || !head) {
            console.error('Missing glyf/loca/head tables');
            process.exit(1);
        }

        console.log(`glyf size: ${glyf.length}, loca size: ${loca.length}`);

        // Parse indexToLocFormat from head
        const indexFormat = new DataView(head.buffer, head.byteOffset).getInt16(50, false);
        console.log(`indexFormat: ${indexFormat}`);

        // Parse loca
        const offsets: number[] = [];
        const locaView = new DataView(loca.buffer, loca.byteOffset);
        const numGlyphs = (indexFormat === 0 ? loca.length / 2 : loca.length / 4) - 1;

        for (let i = 0; i <= numGlyphs; i++) {
            if (indexFormat === 0) {
                offsets.push(locaView.getUint16(i * 2, false) * 2);
            } else {
                offsets.push(locaView.getUint32(i * 4, false));
            }
        }

        console.log(`Parsed ${offsets.length} offsets for ${numGlyphs} glyphs`);

        // Extract glyphs and check for duplicates/patterns
        const glyphs: Uint8Array[] = [];
        let nonEmptyCount = 0;

        for (let i = 0; i < numGlyphs; i++) {
            const start = offsets[i];
            const end = offsets[i + 1];
            const len = end - start;

            if (len > 0) {
                glyphs.push(glyf.subarray(start, end));
                nonEmptyCount++;
            } else {
                glyphs.push(new Uint8Array(0));
            }
        }

        console.log(`Found ${nonEmptyCount} non-empty glyphs`);

        // Check for distinct content
        const hashes = new Set<string>();
        let collisions = 0;

        // Check first 50 non-empty glyphs
        let checked = 0;
        for (let i = 0; i < glyphs.length; i++) {
            if (glyphs[i].length === 0) continue;

            // Create a simple hash/signature of the glyph
            const signature = Buffer.from(glyphs[i].subarray(0, Math.min(glyphs[i].length, 50))).toString('hex');

            if (hashes.has(signature)) {
                collisions++;
            } else {
                hashes.add(signature);
            }

            checked++;
            if (checked > 50) break;
        }

        console.log(`Checked ${checked} glyphs, found ${collisions} collisions in signatures`);

        // Also check if glyphs look valid (header values)
        let validHeaders = 0;
        for (let i = 0; i < glyphs.length; i++) {
            if (glyphs[i].length >= 10) {
                const view = new DataView(glyphs[i].buffer, glyphs[i].byteOffset, 10);
                const nContours = view.getInt16(0, false);
                const xMin = view.getInt16(2, false);
                const yMin = view.getInt16(4, false);
                const xMax = view.getInt16(6, false);
                const yMax = view.getInt16(8, false);

                // Basic sanity check
                if (nContours >= -1 && xMin <= xMax && yMin <= yMax) {
                    validHeaders++;
                }
            }
        }
        console.log(`Checked headers: ${validHeaders}/${nonEmptyCount} look valid`);

        if (collisions > 40) {
            console.error('FAIL: Too many identical glyphs.');
            process.exit(1);
        } else if (validHeaders < nonEmptyCount * 0.9) {
            console.error('FAIL: Many glyphs have invalid headers.');
            process.exit(1);
        } else {
            console.log('PASS: Glyphs appear distinct and valid.');
            process.exit(0);
        }

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
