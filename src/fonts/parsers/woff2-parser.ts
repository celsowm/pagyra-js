import { readUInt16BE, readUInt32BE, readUBASE128 } from '../../compression/utils.js';
import { decompressMultipleTables } from '../../compression/brotli/brotli.js';
import type { FontTableData } from './base-parser.js';
import type { WOFF2TableEntry } from '../../compression/brotli/types.js';

export interface Woff2TableData extends FontTableData {
  flavor: number;
  numTables: number;
  tables: Record<string, Uint8Array>;
  compressionInfo?: {
    type: 'woff2';
    tables: Map<string, {
      compressed: boolean;
      transformLength?: number;
      transformVersion: number;
    }>;
  };
}

const WOFF2_HEADER_SIZE = 48;
const WOFF2_SIGNATURE = 'wOF2';
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ',
  'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS',
  'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc',
  'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
  'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'
];

/**
 * WOFF2 Parser - Single Responsibility: Parse WOFF2 font data into table format
 * 
 * This parser is responsible ONLY for:
 * - Reading WOFF2 headers
 * - Decompressing Brotli data
 * - Extracting raw table data
 * 
 * It does NOT handle:
 * - TTF conversion
 * - Metrics extraction
 * - PDF embedding
 */
export class Woff2Parser {
  private static decoder = new TextDecoder('ascii');

  async parseTables(fontData: Uint8Array): Promise<Woff2TableData> {
    if (fontData.length < WOFF2_HEADER_SIZE) {
      throw new Error('Invalid WOFF2: file too short');
    }

    const signature = Woff2Parser.decoder.decode(fontData.subarray(0, 4));
    if (signature !== WOFF2_SIGNATURE) {
      throw new Error(`Invalid WOFF2 signature: ${signature}`);
    }

    const flavor = readUInt32BE(fontData, 4);
    const numTables = readUInt16BE(fontData, 12);
    const totalCompressedSize = readUInt32BE(fontData, 20);

    const tableDirectory: WOFF2TableEntry[] = [];
    let currentOffset = WOFF2_HEADER_SIZE;
    const compressionInfo = new Map<string, {
      compressed: boolean;
      transformLength?: number;
      transformVersion: number;
    }>();

    for (let i = 0; i < numTables; i++) {
      if (currentOffset >= fontData.length) {
        throw new Error('Invalid WOFF2: Unexpected end of file in Table Directory');
      }

      const flags = fontData[currentOffset++];
      const tagIndex = flags & 0x3F;
      let tag: string;
      if (tagIndex === 0x3F) {
        tag = Woff2Parser.decoder.decode(fontData.subarray(currentOffset, currentOffset + 4));
        currentOffset += 4;
      } else {
        tag = KNOWN_TAGS[tagIndex];
      }

      if (!tag) throw new Error(`Invalid known tag index: ${tagIndex}`);

      const [origLength, bytesReadOrig] = readUBASE128(fontData, currentOffset);
      currentOffset += bytesReadOrig;

      const transformVersion = (flags >> 6) & 0x3;
      let transformLength = 0;

      const isGlyphOrLoca = tagIndex === 10 || tagIndex === 11; // 10=glyf, 11=loca
      const hasTransformLength = (transformVersion !== 0 && transformVersion !== 3) || (transformVersion === 0 && isGlyphOrLoca);

      if (hasTransformLength) {
        const [len, bytesRead] = readUBASE128(fontData, currentOffset);
        transformLength = len;
        currentOffset += bytesRead;
      }

      compressionInfo.set(tag, {
        compressed: origLength !== (transformLength || origLength),
        transformLength: transformLength || undefined,
        transformVersion
      });

      tableDirectory.push({
        tag,
        flags,
        origLength,
        transformLength: transformLength || undefined,
        transformVersion
      });
    }

    const compressedStreamEnd = Math.min(currentOffset + totalCompressedSize, fontData.length);
    const compressedData = fontData.subarray(currentOffset, compressedStreamEnd);

    const decompressedTables = await decompressMultipleTables(compressedData, tableDirectory);

    const filteredTables: Record<string, Uint8Array> = {};
    for (const [tag, data] of decompressedTables.entries()) {
      // Skip loca and glyph variation tables for now as they need special handling
      if (tag === 'gloc' || tag === 'gvar' || tag === 'hvar') continue;
      filteredTables[tag] = data;
    }

    return {
      flavor,
      numTables: Object.keys(filteredTables).length,
      tables: filteredTables,
      compressionInfo: {
        type: 'woff2',
        tables: compressionInfo
      }
    };
  }

  getFormat(): string {
    return 'woff2';
  }
}
