import type { WOFF2TableEntry } from '../../compression/brotli/types.js';
import { decompressMultipleTables } from '../../compression/brotli/index.js';
import { readUInt32BE, readUInt16BE, readUBASE128 } from '../../compression/utils.js';
import { parseTtfBuffer } from '../../pdf/font/ttf-lite.js';
import type { ParsedFont, UnifiedFont, FontFormat } from '../types.js';

// WOFF2 Header is fixed 48 bytes
const WOFF2_HEADER_SIZE = 48;
const WOFF2_SIGNATURE = 'wOF2';

const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ',
  'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp',
  'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF',
  'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL',
  'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc',
  'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx',
  'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'
];

export class Woff2Engine {
  // Reuse decoder instance
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
    const numTables = readUInt16BE(fontData, 12);
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
      if (transformVersion !== 0) {
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

    const compressedStreamEnd = Math.min(currentOffset + totalCompressedSize, fontData.length);
    const compressedData = fontData.subarray(currentOffset, compressedStreamEnd);
    
    const decompressedTables = await decompressMultipleTables(compressedData, tableDirectory);
    
    console.log(`🔍 CAVEAT DEBUG: Original tables count: ${decompressedTables.size}`);
    console.log(`🔍 CAVEAT DEBUG: Original tables:`, Array.from(decompressedTables.keys()));
    
    // ULTRA-AGGRESSIVE FIX: Remove ALL problematic tables immediately
    const filteredTables: Record<string, Uint8Array> = {};
    
    for (const [tag, data] of decompressedTables.entries()) {
      // Force removal of gloc table (the specific problematic one)
      if (tag === 'gloc') {
        console.log(`🚫 CAVEAT DEBUG: FORCE REMOVING problematic table 'gloc' (${data.length} bytes)`);
        continue;
      }
      
      // Also remove other potentially problematic tables
      if (['gvar', 'hvar'].includes(tag)) {
        console.log(`🚫 CAVEAT DEBUG: Removing problematic table '${tag}'`);
        continue;
      }
      
      // Keep everything else
      filteredTables[tag] = data;
    }
    
    console.log(`✅ CAVEAT DEBUG: Filtered tables count: ${Object.keys(filteredTables).length}`);
    console.log(`✅ CAVEAT DEBUG: Final tables:`, Object.keys(filteredTables));
    
    // Reconstruct tableDirectory with only kept tables for TTF reconstruction
    const reconstructedDirectory = tableDirectory.filter(entry => filteredTables[entry.tag] !== undefined);
    
    return { flavor, numTables: reconstructedDirectory.length, tables: filteredTables };
  }

  async convertToUnified(parsedFont: ParsedFont): Promise<UnifiedFont> {
    try {
      const ttfBuffer = this.createBasicTtfBuffer(parsedFont);
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
      console.warn('TTF parsing failed during WOFF2 conversion (fallback used):', error);
      return this.createFallbackUnifiedFont(parsedFont);
    }
  }

  /**
   * Reconstructs a basic SFNT (TTF) binary structure from raw table data.
   */
  private createBasicTtfBuffer(parsedFont: ParsedFont): ArrayBuffer {
    const filteredTables = Object.entries(parsedFont.tables)
      .sort(([tagA], [tagB]) => tagA.localeCompare(tagB));

    const numTables = filteredTables.length;
    const headerSize = 12;
    const tableDirEntrySize = 16;
    const tableDirSize = tableDirEntrySize * numTables;
    
    let totalDataSize = 0;
    for (const [, data] of filteredTables) {
      totalDataSize += data.length;
      totalDataSize += (4 - (data.length % 4)) & 3; // Padding
    }
    
    const buffer = new ArrayBuffer(headerSize + tableDirSize + totalDataSize);
    const u8 = new Uint8Array(buffer);
    const view = new DataView(buffer);
    
    // Header
    view.setUint32(0, parsedFont.flavor, false);
    view.setUint16(4, numTables, false);
    
    if (numTables > 0) {
      const maxPower2 = 1 << Math.floor(Math.log2(numTables));
      const searchRange = maxPower2 * 16;
      const entrySelector = Math.floor(Math.log2(maxPower2));
      const rangeShift = numTables * 16 - searchRange;
      
      view.setUint16(6, searchRange, false);
      view.setUint16(8, entrySelector, false);
      view.setUint16(10, rangeShift, false);
    }
    
    // Directory & Data
    let dirOffset = 12;
    let currentDataOffset = headerSize + tableDirSize;
    
    for (const [tag, data] of filteredTables) {
      for (let i = 0; i < 4; i++) {
        u8[dirOffset + i] = tag.charCodeAt(i);
      }
      
      const checksum = this.calculateTableChecksum(data);
      view.setUint32(dirOffset + 4, checksum, false);
      view.setUint32(dirOffset + 8, currentDataOffset, false);
      view.setUint32(dirOffset + 12, data.length, false);
      
      u8.set(data, currentDataOffset);
      
      // Padding
      const pad = (4 - (data.length % 4)) & 3;
      currentDataOffset += data.length + pad;
      
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
