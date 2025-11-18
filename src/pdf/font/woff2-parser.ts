import { WOFF2Brotli, decompressWithTransform } from '../../compression/brotli/index.js';

class DataParser {
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  getUint8(): number {
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  getUint16(): number {
    const val = this.view.getUint16(this.offset);
    this.offset += 2;
    return val;
  }

  getInt16(): number {
    const val = this.view.getInt16(this.offset);
    this.offset += 2;
    return val;
  }

  getUint32(): number {
    const val = this.view.getUint32(this.offset);
    this.offset += 4;
    return val;
  }

  getUint8Array(length: number): Uint8Array {
    const arr = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
    this.offset += length;
    return arr;
  }

  readBytes(n: number): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < n; i++) {
        bytes.push(this.getUint8());
    }
    return bytes;
  }

  seek(offset: number) {
    this.offset = offset;
  }

  skip(bytes: number) {
    this.offset += bytes;
  }

  tell(): number {
    return this.offset;
  }
}

interface Woff2TableHeader {
  flags: number;
  tag: number;
  origLength: number;
  transformLength?: number;
}

function parseWoff2Header(parser: DataParser) {
  const signature = parser.getUint32();
  if (signature !== 0x774f4632) { // 'wOF2'
    throw new Error('Invalid WOFF2 signature');
  }
  const flavor = parser.getUint32();
  const length = parser.getUint32();
  const numTables = parser.getUint16();
  parser.skip(2); // reserved
  const totalSfntSize = parser.getUint32();
  const totalCompressedSize = parser.getUint32();
  // WOFF2 header is 48 bytes. We have read 24 bytes so far. 48 - 24 = 24.
  parser.skip(24);
  return { flavor, length, numTables, totalSfntSize, totalCompressedSize };
}

function read255UInt16(parser: DataParser): number {
    let value = 0;
    let count = 0;
    while (count < 5) {
        const byte = parser.getUint8();
        value = (value << 7) | (byte & 0x7F);
        if ((byte & 0x80) === 0) {
            return value;
        }
        count++;
    }
    throw new Error('Invalid 255UInt16 encoding');
}

function parseWoff2Directory(parser: DataParser, numTables: number): Woff2TableHeader[] {
  const tables: Woff2TableHeader[] = [];
  let lastTag = 0;

  for (let i = 0; i < numTables; i++) {
    const flags = parser.getUint8();
    const tag = (flags & 0x3F) === 0x3F ? parser.getUint32() : (lastTag + 1);

    const origLength = read255UInt16(parser);
    const transformLength = ((flags >> 6) & 0x3) !== 0 ? read255UInt16(parser) : undefined;

    tables.push({ flags, tag, origLength, transformLength });
    lastTag = tag;
  }
  return tables;
}

function reconstructSfnt(parser: DataParser, directory: Woff2TableHeader[], totalSfntSize: number, flavor: number, totalCompressedSize: number, compressedDataOffset: number) {
  const sfntBuffer = new ArrayBuffer(totalSfntSize);
  const sfntView = new DataView(sfntBuffer);

  parser.seek(compressedDataOffset);
  const compressedData = parser.getUint8Array(totalCompressedSize);
  const decompressedData = decompressWithTransform(compressedData, new WOFF2Brotli(), directory);

  let sfntOffset = 0;
  // SFNT Header
  sfntView.setUint32(sfntOffset, flavor);
  sfntView.setUint16(sfntOffset + 4, directory.length);
  const entrySelector = Math.floor(Math.log2(directory.length));
  sfntView.setUint16(sfntOffset + 6, (1 << entrySelector) * 16);
  sfntView.setUint16(sfntOffset + 8, entrySelector);
  sfntView.setUint16(sfntOffset + 10, directory.length * 16 - (1 << entrySelector) * 16);
  sfntOffset += 12;

  // Table Directory
  let tableOffset = sfntOffset + directory.length * 16;
  let decompressedOffset = 0;

  for (const table of directory) {
      sfntView.setUint32(sfntOffset, table.tag);
      sfntView.setUint32(sfntOffset + 4, 0); // checksum placeholder
      sfntView.setUint32(sfntOffset + 8, tableOffset);
      sfntView.setUint32(sfntOffset + 12, table.origLength);
      sfntOffset += 16;

      const tableData = decompressedData.subarray(decompressedOffset, decompressedOffset + table.origLength);
      new Uint8Array(sfntBuffer, tableOffset).set(tableData);

      tableOffset += (table.origLength + 3) & ~3;
      decompressedOffset += table.origLength;
  }

  return sfntBuffer;
}

export function parseWoff2(buffer: ArrayBuffer): ArrayBuffer {
  const parser = new DataParser(buffer);
  const { flavor, numTables, totalSfntSize, totalCompressedSize } = parseWoff2Header(parser);
  const directory = parseWoff2Directory(parser, numTables);
  const compressedDataOffset = parser.tell();
  return reconstructSfnt(parser, directory, totalSfntSize, flavor, totalCompressedSize, compressedDataOffset);
}
