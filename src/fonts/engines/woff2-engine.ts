import { readUInt16BE, readUInt32BE, readUBASE128 } from '../../compression/utils.js';
import { decompressMultipleTables } from '../../compression/brotli/brotli.js';
import { parseTtfBuffer } from '../../pdf/font/ttf-lite.js';
import type { ParsedFont, UnifiedFont, FontFormat } from '../types.js';
import type { WOFF2TableEntry } from '../../compression/brotli/types.js';

const WOFF2_HEADER_SIZE = 48;
const WOFF2_SIGNATURE = 'wOF2';
const KNOWN_TAGS = [
    'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ',
    'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS',
    'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc',
    'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
    'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'
];

export class Woff2Engine {
    private static decoder = new TextDecoder('ascii');

    async parse(fontData: Uint8Array): Promise<ParsedFont> {
        if (fontData.length < WOFF2_HEADER_SIZE) {
            throw new Error('Invalid WOFF2: file too short');
        }

        const signature = Woff2Engine.decoder.decode(fontData.subarray(0, 4));
        if (signature !== WOFF2_SIGNATURE) {
            throw new Error(`Invalid WOFF2 signature: ${signature}`);
        }

        const flavor = readUInt32BE(fontData, 4);
        const length = readUInt32BE(fontData, 8);
        const numTables = readUInt16BE(fontData, 12);
        // const reserved = readUInt16BE(fontData, 14);
        const totalCompressedSize = readUInt32BE(fontData, 20);

        const tableDirectory: WOFF2TableEntry[] = [];
        let currentOffset = WOFF2_HEADER_SIZE;

        for (let i = 0; i < numTables; i++) {
            if (currentOffset >= fontData.length) {
                throw new Error('Invalid WOFF2: Unexpected end of file in Table Directory');
            }

            const flags = fontData[currentOffset++];
            const tagIndex = flags & 0x3F;
            let tag: string;
            if (tagIndex === 0x3F) {
                tag = Woff2Engine.decoder.decode(fontData.subarray(currentOffset, currentOffset + 4));
                currentOffset += 4;
            } else {
                tag = KNOWN_TAGS[tagIndex];
            }

            if (!tag) throw new Error(`Invalid known tag index: ${tagIndex}`);

            const [origLength, bytesReadOrig] = readUBASE128(fontData, currentOffset);
            currentOffset += bytesReadOrig;

            const transformVersion = (flags >> 6) & 0x3;
            let transformLength = 0;

            // FIX: Correctly determine if transformLength is present
            const isGlyphOrLoca = tagIndex === 10 || tagIndex === 11; // 10=glyf, 11=loca
            const hasTransformLength = (transformVersion !== 0 && transformVersion !== 3) || (transformVersion === 0 && isGlyphOrLoca);

            if (hasTransformLength) {
                const [len, bytesRead] = readUBASE128(fontData, currentOffset);
                transformLength = len;
                currentOffset += bytesRead;
            }

            tableDirectory.push({
                tag,
                flags,
                origLength,
                transformLength: transformLength || undefined,
                transformVersion
            });
        }

        // Determine the end of the compressed stream based on totalCompressedSize
        // The stream starts immediately after the Table Directory
        const compressedStreamEnd = Math.min(currentOffset + totalCompressedSize, fontData.length);
        const compressedData = fontData.subarray(currentOffset, compressedStreamEnd);

        const decompressedTables = await decompressMultipleTables(compressedData, tableDirectory);

        // Filter out unsupported tables or temporary tables
        const filteredTables: Record<string, Uint8Array> = {};
        for (const [tag, data] of decompressedTables.entries()) {
            if (tag === 'gloc') { continue; } // Graphite table not supported
            if (['gvar', 'hvar'].includes(tag)) { continue; } // Variations not supported
            filteredTables[tag] = data;
        }

        // Reconstruct the directory based on what we actually have
        // (Some tables might have been skipped or failed to decompress)
        // const reconstructedDirectory = tableDirectory.filter(entry => filteredTables[entry.tag] !== undefined);

        return {
            flavor,
            numTables: Object.keys(filteredTables).length,
            tables: filteredTables
        };
    }

    async convertToUnified(parsedFont: ParsedFont): Promise<UnifiedFont> {
        try {
            // Attempt to reconstruct a basic TTF/OTF buffer from the parsed tables
            const ttfBuffer = this.createBasicTtfBuffer(parsedFont);
            // Use the TTF parser to extract metrics and outlines
            const ttfMetrics = parseTtfBuffer(ttfBuffer);

            return {
                metrics: {
                    metrics: ttfMetrics.metrics,
                    glyphMetrics: ttfMetrics.glyphMetrics,
                    cmap: ttfMetrics.cmap,
                    headBBox: ttfMetrics.headBBox,
                },
                program: {
                    sourceFormat: 'woff2' as FontFormat,
                    getRawTableData: (tag: string) => parsedFont.tables[tag] || null,
                    getGlyphOutline: ttfMetrics.getGlyphOutline,
                },
            };
        } catch (error) {
            console.warn(`WOFF2 conversion failed for font: ${error instanceof Error ? error.message : String(error)}`);
            return this.createFallbackUnifiedFont(parsedFont);
        }
    }

    private createBasicTtfBuffer(parsedFont: ParsedFont): ArrayBuffer {
        // Sort tables by tag as required by TTF spec
        const filteredTables = Object.entries(parsedFont.tables).sort(([tagA], [tagB]) => tagA.localeCompare(tagB));
        const numTables = filteredTables.length;
        
        const headerSize = 12;
        const tableDirEntrySize = 16;
        const tableDirSize = tableDirEntrySize * numTables;
        
        let totalDataSize = 0;
        for (const [, data] of filteredTables) {
            totalDataSize += (data as Uint8Array).length;
            // Tables must be 4-byte aligned
            totalDataSize += (4 - ((data as Uint8Array).length % 4)) & 3;
        }

        const buffer = new ArrayBuffer(headerSize + tableDirSize + totalDataSize);
        const u8 = new Uint8Array(buffer);
        const view = new DataView(buffer);

        // Offset Table
        view.setUint32(0, parsedFont.flavor, false); // sfnt version
        view.setUint16(4, numTables, false);
        
        // Search Range stuff (standard boilerplate)
        if (numTables > 0) {
            const maxPower2 = 1 << Math.floor(Math.log2(numTables));
            const searchRange = maxPower2 * 16;
            const entrySelector = Math.floor(Math.log2(maxPower2));
            const rangeShift = numTables * 16 - searchRange;
            view.setUint16(6, searchRange, false);
            view.setUint16(8, entrySelector, false);
            view.setUint16(10, rangeShift, false);
        }

        let dirOffset = 12;
        let currentDataOffset = headerSize + tableDirSize;

        for (const [tag, data] of filteredTables) {
            // Tag
            for (let i = 0; i < 4; i++) {
                u8[dirOffset + i] = tag.charCodeAt(i);
            }

            // Checksum (simple sum)
            const checksum = this.calculateTableChecksum(data as Uint8Array);
            view.setUint32(dirOffset + 4, checksum, false);

            // Offset
            view.setUint32(dirOffset + 8, currentDataOffset, false);

            // Length
            view.setUint32(dirOffset + 12, (data as Uint8Array).length, false);

            // Write Data
            u8.set(data as Uint8Array, currentDataOffset);

            // Padding
            const pad = (4 - ((data as Uint8Array).length % 4)) & 3;
            currentDataOffset += (data as Uint8Array).length + pad;

            dirOffset += 16;
        }

        return buffer;
    }

    private calculateTableChecksum(data: Uint8Array): number {
        let sum = 0;
        const nLongs = Math.floor(data.length / 4);
        const view = new DataView(data.buffer, data.byteOffset, data.length);
        
        for (let i = 0; i < nLongs; i++) {
            sum = (sum + view.getUint32(i * 4, false)) >>> 0;
        }
        
        // Handle remaining bytes
        const leftOver = data.length % 4;
        if (leftOver > 0) {
            let val = 0;
            for (let i = 0; i < leftOver; i++) {
                val = (val << 8) | data[nLongs * 4 + i];
            }
            val = val << (8 * (4 - leftOver));
            sum = (sum + val) >>> 0;
        }
        
        return sum;
    }

    private createFallbackUnifiedFont(parsedFont: ParsedFont): UnifiedFont {
        return {
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
                    [1, { advanceWidth: 250, leftSideBearing: 0 }],
                    [2, { advanceWidth: 500, leftSideBearing: 0 }],
                ]),
                cmap: {
                    getGlyphId: () => 1,
                    hasCodePoint: () => true,
                    unicodeMap: new Map([[65, 1]]),
                },
                headBBox: [0, -200, 1000, 800]
            },
            program: {
                sourceFormat: 'woff2' as FontFormat,
                getRawTableData: (tag: string) => parsedFont.tables[tag] || null,
                getGlyphOutline: () => null,
            },
        };
    }
}
