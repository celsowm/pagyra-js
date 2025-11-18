import { readUInt16BE, readUInt32BE, readUBASE128 } from '../../compression/utils.js';
import { decompressMultipleTables } from '../../compression/brotli/brotli.js';
import type { FontTableData } from './base-parser.js';
import type { WOFF2TableEntry } from '../../compression/brotli/types.js';

/**
 * WOFF2 Parser - Pure responsibility for extracting WOFF2 table data
 * 
 * This parser is responsible ONLY for:
 * - Parsing WOFF2 file structure
 * - Extracting compressed table data
 * - Decompressing WOFF2 tables
 * 
 * It does NOT handle:
 * - TTF conversion
 * - Metrics extraction
 * - PDF embedding
 * - Font program creation
 */
export class Woff2Parser {
  private static readonly decoder = new TextDecoder('ascii');
  private static readonly HEADER_SIZE = 48;
  private static readonly SIGNATURE = 'wOF2';
  private static readonly KNOWN_TAGS = [
    'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ',
    'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS',
    'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc',
    'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
    'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'
  ];

  getFormat(): string {
    return 'woff2';
  }

  /**
   * Parse WOFF2 font and extract table data
   * 
   * @param fontData - Raw WOFF2 font data
   * @returns Parsed table data structure
   */
  async parseTables(fontData: Uint8Array): Promise<FontTableData> {
    console.log(`WOFF2 Parser: Starting parse, file size: ${fontData.length} bytes`);
    
    if (fontData.length < Woff2Parser.HEADER_SIZE) {
      throw new Error('Invalid WOFF2: file too short');
    }

    const signature = Woff2Parser.decoder.decode(fontData.subarray(0, 4));
    if (signature !== Woff2Parser.SIGNATURE) {
      throw new Error(`Invalid WOFF2 signature: ${signature}`);
    }

    const flavor = readUInt32BE(fontData, 4);
    const numTables = readUInt16BE(fontData, 12);
    const totalCompressedSize = readUInt32BE(fontData, 20);

    console.log(`WOFF2 Parser: Header parsed - flavor: 0x${flavor.toString(16)}, numTables: ${numTables}, compressedSize: ${totalCompressedSize}`);

    const tableDirectory: WOFF2TableEntry[] = [];
    let currentOffset = Woff2Parser.HEADER_SIZE;

    // Parse table directory
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
        tag = Woff2Parser.KNOWN_TAGS[tagIndex];
      }

      if (!tag) throw new Error(`Invalid known tag index: ${tagIndex}`);

      const [origLength, bytesReadOrig] = readUBASE128(fontData, currentOffset);
      currentOffset += bytesReadOrig;

      const transformVersion = (flags >> 6) & 0x3;
      let transformLength = 0;

      // Determine if transformLength is present in the stream
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

    const compressedStreamEnd = Math.min(currentOffset + totalCompressedSize, fontData.length);
    const compressedData = fontData.subarray(currentOffset, compressedStreamEnd);

    console.log(`WOFF2 Parser: Decompressing ${tableDirectory.length} tables`);
    const decompressedTables = await decompressMultipleTables(compressedData, tableDirectory);
    
    console.log(`WOFF2 Parser: Decompressed tables: ${Array.from(decompressedTables.keys()).join(', ')}`);

    // Convert Map to Record for compatibility
    const filteredTables: Record<string, Uint8Array> = {};
    const compressionInfo = new Map<string, any>();

    for (const [tag, data] of decompressedTables.entries()) {
      // Skip variable font tables that we don't support yet
      if (['gvar', 'hvar', 'MVAR', 'STAT', 'avar', 'cvar', 'fvar'].includes(tag)) {
        console.log(`WOFF2 Parser: Skipping unsupported variable font table: ${tag}`);
        continue;
      }
      console.log(`WOFF2 Parser: Adding table ${tag} (${data.length} bytes)`);
      filteredTables[tag] = data;
      
      // Track compression info
      const originalTableEntry = tableDirectory.find(entry => entry.tag === tag);
      if (originalTableEntry) {
        compressionInfo.set(tag, {
          compressed: true,
          originalLength: originalTableEntry.origLength,
          compressedLength: data.length
        });
      }
    }

    // Verify we have essential tables
    const essentialTables = ['head', 'hhea', 'maxp', 'hmtx', 'cmap', 'name'];
    const missingTables = essentialTables.filter(tag => !filteredTables[tag]);
    if (missingTables.length > 0) {
      console.warn(`WOFF2 Parser: Missing essential tables: ${missingTables.join(', ')}`);
    }
    
    console.log(`WOFF2 Parser: Final table count: ${Object.keys(filteredTables).length}`);

    return {
      flavor,
      tables: filteredTables,
      compressionInfo: {
        type: 'woff2' as const,
        tables: compressionInfo
      }
    };
  }
}
