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

/**
 * WOFF2 engine for Pagyra.
 *
 * IMPORTANT:
 * - This parses a *real* WOFF2 header (offsets/fields according to the spec).
 * - The table directory, however, uses an INTERNAL fixed 16-byte layout
 *   expected by our Brotli pipeline, and is NOT the official WOFF2
 *   UIntBase128/flags format.
 *
 * That is: header is spec-compatible; directory is a simplified internal
 * representation to feed `decompressMultipleTables`.
 */
export class Woff2Engine {
  private decoder = new TextDecoder('ascii');

  async parse(fontData: Uint8Array): Promise<ParsedFont> {
    // Minimal length to contain the full WOFF2 header (48 bytes)
    if (fontData.length < 48) {
      throw new Error('Invalid WOFF2: file too short');
    }

    // --- Header (spec offsets) ------------------------------------------------
    const signature = this.decoder.decode(fontData.subarray(0, 4));
    if (signature !== 'wOF2') {
      throw new Error(`Invalid WOFF2 signature: ${signature}`);
    }

    const flavor = readUInt32BE(fontData, 4);
    const length = readUInt32BE(fontData, 8);
    const numTables = readUInt16BE(fontData, 12);
    const reserved = readUInt16BE(fontData, 14);

    if (reserved !== 0) {
      throw new Error('Invalid WOFF2 reserved field (must be 0)');
    }

    const totalSfntSize = readUInt32BE(fontData, 16);
    const totalCompressedSize = readUInt32BE(fontData, 20);

    // majorVersion, minorVersion, meta*, priv* ignored for now (24–47)

    // Basic sanity: length should not claim more than the buffer we have
    if (length > fontData.length) {
      throw new Error(
        `Invalid WOFF2 length field: ${length} > file size ${fontData.length}`,
      );
    }

    if (totalSfntSize === 0 || totalCompressedSize === 0) {
      throw new Error('Invalid WOFF2: totalSfntSize or totalCompressedSize is zero');
    }

    // --- Internal table directory (NON-SPEC) ----------------------------------
    //
    // We assume an internal, preprocessed layout:
    //
    //  offset + 0  : tag[4] (ASCII)
    //  offset + 4  : origChecksum (uint32)
    //  offset + 8  : flags / transformByte (uint8)
    //  offset + 9  : transformLength (uint24, optional)
    //  offset + 12 : origLength (uint32)
    //
    // Total: 16 bytes per entry.
    //
    // This is NOT the official WOFF2 directory format. It is an internal
    // representation consumed by `decompressMultipleTables`.
    const tableDirOffset = 48;
    const entries: WOFF2TableEntry[] = [];
    let dirOffset = tableDirOffset;

    for (let i = 0; i < numTables; i++) {
      const tagBytes = fontData.subarray(dirOffset, dirOffset + 4);
      const tag = this.decoder.decode(tagBytes);

      const origChecksum = readUInt32BE(fontData, dirOffset + 4);
      const transformByte = fontData[dirOffset + 8];
      const transformVersion = transformByte & 0x1f;

      let transformLength: number | undefined;

      // We deliberately do NOT reject unknown transformVersion values here.
      // The downstream Brotli/WOFF2 pipeline can decide what to do with it.
      if (transformVersion !== 15) {
        transformLength = readUInt24BE(fontData, dirOffset + 9);
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

    // --- Compressed data slice -----------------------------------------------
    const compressedOffset = tableDirOffset + numTables * 16;

    if (compressedOffset + totalCompressedSize > fontData.length) {
      throw new Error('Invalid WOFF2: compressed block exceeds file length');
    }

    const compressedData = fontData.subarray(
      compressedOffset,
      compressedOffset + totalCompressedSize,
    );

    // decompressMultipleTables is responsible for:
    // - Brotli inflation
    // - Applying per-table transforms
    // - Producing final sfnt table buffers keyed by tag
    const tablesMap = await decompressMultipleTables(compressedData, entries);

    const tables: Record<string, Uint8Array> = {};
    for (const [tag, data] of tablesMap) {
      tables[tag] = data;
    }

    // At this stage:
    // - flavor == original sfntVersion
    // - tables[tag] contains decompressed TTF/OTF tables
    return {
      flavor,
      numTables,
      tables,
    };
  }

  async convertToUnified(parsedFont: ParsedFont): Promise<UnifiedFont> {
    // Reconstruct a TTF sfnt buffer from the decompressed tables and
    // reuse the existing lightweight TTF parser.
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
        // The original container is WOFF2, but the font program we expose
        // is in sfnt/TTF layout reconstructed from the tables.
        sourceFormat: 'woff2' as FontFormat,
        getRawTableData: (tag: string) => parsedFont.tables[tag] || null,
        getGlyphOutline: ttfMetrics.getGlyphOutline,
      },
    };
  }

  /**
   * Rebuilds a minimal, but structurally valid, TTF/OTF sfnt from
   * decompressed tables:
   * - header(12)
   * - table directory (16 * numTables)
   * - table data with 4-byte alignment
   *
   * Checksums are left as zero (internal usage only).
   */
  private reconstructTtfBuffer(parsedFont: ParsedFont): ArrayBuffer {
    const sfntVersion = parsedFont.flavor >>> 0;
    const numTables = parsedFont.numTables;

    const headerSize = 12;
    const tableDirSize = 16 * numTables;

    // Build a sorted list of tables for deterministic output
    const tableEntries: Array<{ tag: string; data: Uint8Array }> = [];

    for (const [tag, data] of Object.entries(parsedFont.tables)) {
      tableEntries.push({ tag, data });
    }

    tableEntries.sort((a, b) => a.tag.localeCompare(b.tag));

    // Compute total size of table data including 4-byte padding per table
    let totalDataSize = 0;
    for (const { data } of tableEntries) {
      totalDataSize += data.length;
      totalDataSize += (4 - (data.length % 4)) & 3; // padding to multiple of 4
    }

    const buffer = new ArrayBuffer(headerSize + tableDirSize + totalDataSize);
    const u8 = new Uint8Array(buffer);
    const view = new DataView(buffer);

    // --- sfnt header ----------------------------------------------------------
    view.setUint32(0, sfntVersion, false); // big endian
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

    // --- table directory + data ----------------------------------------------
    let dirOffset = 12;
    let currentOffset = headerSize + tableDirSize;

    for (const { tag, data } of tableEntries) {
      // Directory entry: tag[4]
      for (let i = 0; i < 4; i++) {
        u8[dirOffset + i] = tag.charCodeAt(i) & 0xff;
      }

      // Checksum placeholder (0 for now; internal use only)
      view.setUint32(dirOffset + 4, 0, false);
      view.setUint32(dirOffset + 8, currentOffset, false);
      view.setUint32(dirOffset + 12, data.length, false);

      // Table data
      u8.set(data, currentOffset);
      currentOffset += data.length;

      // Pad to 4-byte boundary
      const pad = (4 - (currentOffset % 4)) & 3;
      for (let i = 0; i < pad; i++) {
        u8[currentOffset + i] = 0;
      }
      currentOffset += pad;

      dirOffset += 16;
    }

    return buffer;
  }
}
