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
