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
    // We ignore header length/metadata offsets for core parsing, 
    // but strictly we should check fontData.length vs header totalLength.
    const numTables = readUInt16BE(fontData, 12);
    
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
      
      // Transformation version (0-3)
      // 0 = null/none (except for glyf/loca which have specific defaults)
      // 1/2 = specific WOFF2 transforms
      // 3 = reserved
      const transformVersion = (flags >> 6) & 0x3;
      
      let transformLength = 0;
      // If transform is applied (version != 0) OR specifically for glyf/loca where 
      // defaults apply, the length might be encoded. 
      // Note: The logic below follows the standard WOFF2 reading flow: 
      // if (version != 0) read encoded length.
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

    // The rest of the file is the compressed data stream
    const compressedData = fontData.subarray(currentOffset);
    
    // Important: decompressMultipleTables is assumed to handle 
    // WOFF2 specific table reconstruction (e.g. reconstructing 'loca' from 'glyf')
    const decompressedTables = await decompressMultipleTables(compressedData, tableDirectory);
    
    const tables: Record<string, Uint8Array> = {};
    for (const [tag, data] of decompressedTables.entries()) {
      tables[tag] = data;
    }

    return { flavor, numTables, tables };
  }

  async convertToUnified(parsedFont: ParsedFont): Promise<UnifiedFont> {
    // Reconstruct a container (SFNT) to use the generic TTF parser
    const ttfBuffer = this.createBasicTtfBuffer(parsedFont);
    
    try {
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
      console.warn('TTF parsing failed during WOFF2 conversion, using fallback metrics.', error);
      return this.createFallbackUnifiedFont(parsedFont);
    }
  }

  /**
   * Reconstructs a basic SFNT (TTF) binary structure from raw table data.
   * This allows us to reuse standard TTF parsers for WOFF2 data.
   */
  private createBasicTtfBuffer(parsedFont: ParsedFont): ArrayBuffer {
    // TTF tables must be sorted by tag for binary search and checksum compliance
    const sortedTables = Object.entries(parsedFont.tables)
      .sort(([tagA], [tagB]) => tagA.localeCompare(tagB));

    const numTables = sortedTables.length;
    const headerSize = 12;
    const tableDirEntrySize = 16;
    const tableDirSize = tableDirEntrySize * numTables;
    
    // Calculate total size needed including padding
    let totalDataSize = 0;
    for (const [, data] of sortedTables) {
      totalDataSize += data.length;
      // Tables must be 4-byte aligned
      totalDataSize += (4 - (data.length % 4)) & 3; 
    }
    
    const buffer = new ArrayBuffer(headerSize + tableDirSize + totalDataSize);
    const u8 = new Uint8Array(buffer);
    const view = new DataView(buffer);
    
    // --- Write Offset Table (Header) ---
    view.setUint32(0, parsedFont.flavor, false); // sfnt version
    view.setUint16(4, numTables, false);
    
    if (numTables > 0) {
      // Calculation of searchRange, entrySelector, rangeShift
      const maxPower2 = 1 << Math.floor(Math.log2(numTables));
      const searchRange = maxPower2 * 16;
      const entrySelector = Math.floor(Math.log2(maxPower2));
      const rangeShift = numTables * 16 - searchRange;
      
      view.setUint16(6, searchRange, false);
      view.setUint16(8, entrySelector, false);
      view.setUint16(10, rangeShift, false);
    }
    
    // --- Write Table Directory & Data ---
    let dirOffset = 12;
    let currentDataOffset = headerSize + tableDirSize;
    
    for (const [tag, data] of sortedTables) {
      // 1. Write Tag (4 bytes)
      for (let i = 0; i < 4; i++) {
        u8[dirOffset + i] = tag.charCodeAt(i);
      }
      
      // 2. Calculate Checksum
      const checksum = this.calculateTableChecksum(data);
      view.setUint32(dirOffset + 4, checksum, false);
      
      // 3. Offset & Length
      view.setUint32(dirOffset + 8, currentDataOffset, false);
      view.setUint32(dirOffset + 12, data.length, false);
      
      // 4. Write Data
      u8.set(data, currentDataOffset);
      
      // 5. Handle Padding (zero fill)
      const pad = (4 - (data.length % 4)) & 3;
      currentDataOffset += data.length;
      if (pad > 0) {
        // Uint8Array is zero-initialized by default, but explicit clarity helps
        // if reusing buffers. Here, new ArrayBuffer implies 0s.
        currentDataOffset += pad; 
      }
      
      dirOffset += 16;
    }
    
    return buffer;
  }

  private calculateTableChecksum(data: Uint8Array): number {
    let sum = 0;
    const nLongs = Math.floor(data.length / 4);
    const view = new DataView(data.buffer, data.byteOffset, data.length);

    for (let i = 0; i < nLongs; i++) {
      // Use simple addition; overflow is handled by bitwise operator | 0 at end
      // strictly, TTF uses unsigned 32-bit addition (modulo 2^32)
      sum = (sum + view.getUint32(i * 4, false)) >>> 0; 
    }

    // Handle remaining bytes (padding logic for checksum)
    const leftOver = data.length % 4;
    if (leftOver > 0) {
      let val = 0;
      // We construct a uint32 from the remaining bytes
      // byte0 << 24 | byte1 << 16 | ...
      for (let i = 0; i < leftOver; i++) {
        val = (val << 8) | data[nLongs * 4 + i];
      }
      // Shift remaining bits to align to the left (Big Endian padding)
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
          [0, { advanceWidth: 500, leftSideBearing: 0 }], // .notdef
          [1, { advanceWidth: 250, leftSideBearing: 0 }], // space
          [2, { advanceWidth: 500, leftSideBearing: 0 }],
        ]),
        cmap: {
          getGlyphId: () => 1,
          hasCodePoint: () => true,
          unicodeMap: new Map([[65, 1]]), // 'A' -> glyph 1 example
        },
        headBBox: [0, -200, 1000, 800] // Add plausible BBox
      },
      program: {
        sourceFormat: 'woff2' as FontFormat,
        getRawTableData: (tag: string) => parsedFont.tables[tag] || null,
        getGlyphOutline: () => null, // No outlines in fallback
      },
    };
  }
}