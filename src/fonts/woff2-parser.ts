import type { ParsedFont } from './types.js';
import type { WOFF2TableEntry } from '../compression/brotli/types.js';
import { decompressMultipleTables } from '../compression/brotli/index.js';
import { readUInt32BE } from '../compression/utils.js';

const readUInt16BE = (buf: Uint8Array, offset: number): number => {
  return (buf[offset] << 8) | buf[offset + 1];
};

const readUInt24BE = (buf: Uint8Array, offset: number): number => {
  return (buf[offset] << 16) | (buf[offset + 1] << 8) | buf[offset + 2];
};

export async function parseWoff2(fontData: Uint8Array): Promise<ParsedFont> {
  if (fontData.length < 48) {
    throw new Error('Invalid WOFF2: file too short');
  }

  const signature = new TextDecoder().decode(fontData.slice(0, 4));
  if (signature !== 'wOF2') {
    throw new Error(`Invalid WOFF2 signature: ${signature}`);
  }

  const flavor = readUInt32BE(fontData, 4);
  const numTables = readUInt16BE(fontData, 8);

  // Extended header at offset 44
  const extendedOffset = 44;
  const reserved = readUInt16BE(fontData, extendedOffset);
  if (reserved !== 0) {
    throw new Error('Invalid WOFF2 extended header reserved field');
  }
  const totalCompressedSize = readUInt16BE(fontData, extendedOffset + 2);

  // Table directory starts at 48
  const tableDirOffset = 48;
  const entries: WOFF2TableEntry[] = [];
  let dirOffset = tableDirOffset;

  for (let i = 0; i < numTables; i++) {
    const tag = new TextDecoder().decode(fontData.slice(dirOffset, dirOffset + 4));
    const origChecksum = readUInt32BE(fontData, dirOffset + 4);
    const transformByte = fontData[dirOffset + 8];
    const transformVersion = transformByte & 0x1F; // low 5 bits transform ID
    let transformLength: number | undefined;
    if (transformVersion !== 15) { // 15 = 0x0F no transform
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

  const compressedOffset = tableDirOffset + numTables * 16;
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
