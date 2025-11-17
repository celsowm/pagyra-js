import type { ParsedFont } from './types.js';
import { decompress } from '../compression/index.js';
import { readUInt32BE } from '../compression/utils.js';

const readUInt16BE = (buf: Uint8Array, offset: number): number => {
  return (buf[offset] << 8) | buf[offset + 1];
};

export async function parseWoff(fontData: Uint8Array): Promise<ParsedFont> {
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

  const flavor = readUInt32BE(fontData, 4);
  const numTables = readUInt16BE(fontData, 8);

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

    if (offset === 0 || origLength === 0) {
      continue;
    }

    let tableData: Uint8Array;
    if (compLength !== origLength) {
      const compressed = fontData.slice(offset, offset + compLength);
      tableData = await decompress(compressed);
      if (tableData.length !== origLength) {
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
