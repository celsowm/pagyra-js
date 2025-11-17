import { decompress } from '../../compression/index.js';
import { readUInt32BE } from '../../compression/utils.js';
import { parseTtfBuffer } from '../../pdf/font/ttf-lite.js';
import type { TtfFontMetrics } from '../../types/fonts.js';
import type { ParsedFont, UnifiedFont, FontFormat } from '../types.js';

const readUInt16BE = (buf: Uint8Array, offset: number): number => {
  return (buf[offset] << 8) | buf[offset + 1];
};

export class WoffEngine {
  async parse(fontData: Uint8Array): Promise<ParsedFont> {
    if (fontData.length < 4) {
      throw new Error('Invalid WOFF: file too short');
    }

    const signature = new TextDecoder().decode(fontData.slice(0, 4));
    if (signature !== 'wOFF') {
      throw new Error(`Invalid WOFF signature: ${signature}`);
    }

    if (fontData.length < 44) {
      throw new Error('Invalid WOFF: file too short');
    }

    // Ler campos do cabeçalho conforme especificação WOFF 1.0
    const flavor = readUInt32BE(fontData, 4);
    const length = readUInt32BE(fontData, 8);
    const numTables = readUInt16BE(fontData, 12);
    const reserved = readUInt16BE(fontData, 14); // Deve ser zero
    const totalSfntSize = readUInt32BE(fontData, 16);
    const majorVersion = readUInt16BE(fontData, 20);
    const minorVersion = readUInt16BE(fontData, 22);
    const metaOffset = readUInt32BE(fontData, 24);
    const metaLength = readUInt32BE(fontData, 28);
    const metaOrigLength = readUInt32BE(fontData, 32);
    const privOffset = readUInt32BE(fontData, 36);
    const privLength = readUInt32BE(fontData, 40);

    if (reserved !== 0) {
      console.warn(`WOFF reserved field non-zero: ${reserved}`);
    }

    const tableDirOffset = 44;
    const tables: Record<string, Uint8Array> = {};
    let dirOffset = tableDirOffset;

    for (let i = 0; i < numTables; i++) {
      const tag = new TextDecoder().decode(fontData.slice(dirOffset, dirOffset + 4));
      const offset = readUInt32BE(fontData, dirOffset + 4);
      const compLength = readUInt32BE(fontData, dirOffset + 8);
      const origLength = readUInt32BE(fontData, dirOffset + 12);
      // origChecksum = readUInt32BE(fontData, dirOffset + 16);

      dirOffset += 20;

      // Pular tabelas vazias ou inválidas
      if (offset === 0 || origLength === 0 || origLength > 10_000_000) {
        console.warn(`Skipping invalid table ${tag}: offset=${offset}, length=${origLength}`);
        continue;
      }

      let tableData: Uint8Array;
      if (compLength !== origLength) {
        const compressed = fontData.slice(offset, offset + compLength);
        tableData = await decompress(compressed);
        if (tableData.length !== origLength) {
          console.error(`Tabela ${tag} - Comprimento esperado: ${origLength}, obtido: ${tableData.length}`);
          console.error(`Dados comprimidos: ${compressed.slice(0, 16).join(',')}...`);
          console.error(`Dados descomprimidos: ${tableData.slice(0, 16).join(',')}...`);
          throw new Error(`Decompression size mismatch for table ${tag}: expected ${origLength}, got ${tableData.length}`);
        }
      } else {
        tableData = fontData.slice(offset, offset + origLength);
      }

      tables[tag] = tableData;
    }

    return {
      flavor,
      numTables,
      tables,
    };
  }

  async convertToUnified(parsedFont: ParsedFont): Promise<UnifiedFont> {
    // Convert WOFF tables to TTF format and parse with TTF engine
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
        sourceFormat: 'woff' as FontFormat,
        getRawTableData: (tag: string) => parsedFont.tables[tag] || null,
        getGlyphOutline: ttfMetrics.getGlyphOutline,
      },
    };
  }

  private reconstructTtfBuffer(parsedFont: ParsedFont): ArrayBuffer {
    // Simple TTF reconstruction from WOFF tables
    // This is a simplified version - a full implementation would need proper table ordering and checksums
    const sfntVersion = parsedFont.flavor >>> 0; // TTF/OTF flavor
    const numTables = parsedFont.numTables;

    // Calculate required space: header(12) + tableDir(16*numTables) + tableData
    const headerSize = 12;
    const tableDirSize = 16 * numTables;
    let totalDataSize = 0;
    const tableEntries: Array<{tag: string, data: Uint8Array}> = [];

    // Sort tables by tag for deterministic order
    Object.entries(parsedFont.tables).sort(([a], [b]) => a.localeCompare(b)).forEach(([tag, data]) => {
      tableEntries.push({tag, data});
      totalDataSize += data.length;
    });

    const buffer = new ArrayBuffer(headerSize + tableDirSize + totalDataSize);
    const view = new Uint8Array(buffer);
    const dataView = new DataView(buffer);

    // Write TTF header
    dataView.setUint32(0, sfntVersion, false); // Big endian
    dataView.setUint16(4, numTables, false);
    // searchRange, entrySelector, rangeShift - we can leave as 0 for now

    let currentOffset = headerSize + tableDirSize;
    let dirOffset = 12;

    for (const entry of tableEntries) {
      const { tag, data } = entry;

      // Write table directory entry
      for (let i = 0; i < 4; i++) {
        view[dirOffset + i] = tag.charCodeAt(i);
      }
      dataView.setUint32(dirOffset + 4, 0, false); // checksum (placeholder)
      dataView.setUint32(dirOffset + 8, currentOffset, false); // offset
      dataView.setUint32(dirOffset + 12, data.length, false); // length

      // Write table data
      view.set(data, currentOffset);

      currentOffset += data.length;
      dirOffset += 16;
    }

    return buffer;
  }
}
