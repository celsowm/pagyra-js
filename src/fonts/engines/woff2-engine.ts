import type { WOFF2TableEntry } from '../../compression/brotli/types.js';
import { decompressMultipleTables } from '../../compression/brotli/index.js';
import { readUInt32BE } from '../../compression/utils.js';
import { parseTtfBuffer } from '../../pdf/font/ttf-lite.js';
import type { ParsedFont, UnifiedFont, FontFormat } from '../types.js';

const readUInt16BE = (buf: Uint8Array, offset: number): number => {
  return (buf[offset] << 8) | buf[offset + 1];
};

const readUInt24BE = (buf: Uint8Array, offset: number): number => {
  return (buf[offset] << 16) | (buf[offset + 1] << 8) | buf[offset + 2];
};

export class Woff2Engine {
  private decoder = new TextDecoder('ascii');

  async parse(fontData: Uint8Array): Promise<ParsedFont> {
    if (fontData.length < 48) {
      throw new Error('Invalid WOFF2: file too short');
    }

    const signature = this.decoder.decode(fontData.slice(0, 4));
    if (signature !== 'wOF2') {
      throw new Error(`Invalid WOFF2 signature: ${signature}`);
    }

    const flavor = readUInt32BE(fontData, 4);
    const length = readUInt32BE(fontData, 8);
    const numTables = readUInt16BE(fontData, 12);
    const reserved = readUInt16BE(fontData, 14);
    if (reserved !== 0) {
      throw new Error('Invalid WOFF2 reserved field');
    }

    const totalSfntSize = readUInt32BE(fontData, 16);
    const totalCompressedSize = readUInt32BE(fontData, 20);
    // Note: majorVersion, minorVersion, metaOffset, metaLength, metaOrigLength,
    // privOffset, privLength are ignored for simplicity (offsets 24-47)

    // Table directory starts at 48
    // NOTE: This implementation uses a simplified 16-byte fixed length per entry,
    // which does NOT conform to the WOFF2 specification that uses variable-length
    // UIntBase128 encoded fields. This is designed for internal/preprocessed formats.
    const tableDirOffset = 48;
    const entries: WOFF2TableEntry[] = [];
    let dirOffset = tableDirOffset;

    for (let i = 0; i < numTables; i++) {
      const tag = this.decoder.decode(fontData.slice(dirOffset, dirOffset + 4));
      const origChecksum = readUInt32BE(fontData, dirOffset + 4);
      const transformByte = fontData[dirOffset + 8];
      const transformVersion = transformByte & 0x1F;
      let transformLength: number | undefined;

      // Adicionar validação da versão de transformação
      if (transformVersion > 4) { // Versões 0-4 são válidas pelo spec
        throw new Error(`Invalid WOFF2 transform version: ${transformVersion}`);
      }

      if (transformVersion !== 15) {
        transformLength = readUInt24BE(fontData, dirOffset + 9);

        // Validate transform length against compressed size to prevent overflow
        if (transformLength && transformLength > totalCompressedSize) {
          throw new Error(`Suspicious WOFF2 transform length: ${transformLength}`);
        }
      }
      const origLength = readUInt32BE(fontData, dirOffset + 12);

      entries.push({
        tag,
        flags: transformByte,
        transformVersion,
        transformLength,
        origLength,
        origChecksum,
      });

      dirOffset += 16;
    }

    const compressedOffset = tableDirOffset + numTables * 16;
    if (compressedOffset + totalCompressedSize > fontData.length) {
      throw new Error('Invalid WOFF2: compressed size exceeds file length');
    }
    const compressedData = fontData.slice(compressedOffset, compressedOffset + totalCompressedSize);

    const tablesMap = await decompressMultipleTables(compressedData, entries);

    const tables: Record<string, Uint8Array> = {};
    for (const [tag, data] of tablesMap) {
      tables[tag] = data;
    }

    return {
      flavor,
      numTables,
      tables,
    };
  }

  async convertToUnified(parsedFont: ParsedFont): Promise<UnifiedFont> {
    // Convert WOFF2 tables to TTF format and parse with TTF engine
    const ttfBuffer = this.reconstructTtfBuffer(parsedFont);
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
  }

  private reconstructTtfBuffer(parsedFont: ParsedFont): ArrayBuffer {
    // Simple TTF reconstruction from WOFF2 tables
    // This is a simplified version - a full implementation would need proper table ordering and checksums
    const sfntVersion = parsedFont.flavor >>> 0; // TTF/OTF flavor
    const numTables = parsedFont.numTables;

    // Calculate required space: header(12) + tableDir(16*numTables) + tableData (with 4-byte alignment)
    const headerSize = 12;
    const tableDirSize = 16 * numTables;
    let totalDataSize = 0;
    const tableEntries: Array<{tag: string, data: Uint8Array}> = [];

    // Sort tables by tag for deterministic order
    Object.entries(parsedFont.tables).sort(([a], [b]) => a.localeCompare(b)).forEach(([tag, data]) => {
      tableEntries.push({tag, data});
      totalDataSize += data.length;
      // Account for padding to 4-byte alignment
      totalDataSize += (4 - (data.length % 4)) & 3;
    });

    const buffer = new ArrayBuffer(headerSize + tableDirSize + totalDataSize);
    const view = new Uint8Array(buffer);
    const dataView = new DataView(buffer);

    // Write TTF header
    dataView.setUint32(0, sfntVersion, false); // Big endian
    dataView.setUint16(4, numTables, false);
    // Calculate TTF header fields: searchRange, entrySelector, rangeShift
    if (numTables > 0) {
      const maxPower2 = 1 << Math.floor(Math.log2(numTables));
      const searchRange = maxPower2 * 16;
      const entrySelector = Math.floor(Math.log2(maxPower2));
      const rangeShift = numTables * 16 - searchRange;
      dataView.setUint16(6, searchRange, false);
      dataView.setUint16(8, entrySelector, false);
      dataView.setUint16(10, rangeShift, false);
    }

    let currentOffset = headerSize + tableDirSize;
    let dirOffset = 12;

    for (const entry of tableEntries) {
      const { tag, data } = entry;

      // Write table directory entry
      for (let i = 0; i < 4; i++) {
        view[dirOffset + i] = tag.charCodeAt(i);
      }
      dataView.setUint32(dirOffset + 4, 0, false); // checksum (placeholder: INTERNAL ONLY, checksums set to 0)
      dataView.setUint32(dirOffset + 8, currentOffset, false); // offset
      dataView.setUint32(dirOffset + 12, data.length, false); // length

      // Write table data
      view.set(data, currentOffset);
      currentOffset += data.length;

      // Pad to 4-byte alignment for TTF format
      const pad = (4 - (currentOffset % 4)) & 3;
      for (let i = 0; i < pad; i++) {
        view[currentOffset + i] = 0;
      }
      currentOffset += pad;

      dirOffset += 16;
    }

    return buffer;
  }
}
