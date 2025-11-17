import { WOFFDeflate, decompress } from '../../compression/deflate.js';

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

  seek(offset: number) {
    this.offset = offset;
  }

  skip(bytes: number) {
    this.offset += bytes;
  }
}

interface WoffTableHeader {
  tag: number;
  offset: number;
  compLength: number;
  origLength: number;
  origChecksum: number;
}

function parseWoffHeader(parser: DataParser) {
  const signature = parser.getUint32();
  if (signature !== 0x774f4646) { // 'wOFF'
    throw new Error('Invalid WOFF signature');
  }
  const flavor = parser.getUint32();
  const length = parser.getUint32();
  const numTables = parser.getUint16();
  parser.skip(2); // reserved
  const totalSfntSize = parser.getUint32();
  // Skip over versions, meta, and private data offsets/lengths.
  // total header size is 44 bytes. we have read 20 bytes so far. 44 - 20 = 24.
  parser.skip(24);
  return { flavor, length, numTables, totalSfntSize };
}

function parseWoffDirectory(parser: DataParser, numTables: number): WoffTableHeader[] {
  const tables: WoffTableHeader[] = [];
  for (let i = 0; i < numTables; i++) {
    tables.push({
      tag: parser.getUint32(),
      offset: parser.getUint32(),
      compLength: parser.getUint32(),
      origLength: parser.getUint32(),
      origChecksum: parser.getUint32(),
    });
  }
  return tables;
}

function reconstructSfnt(parser: DataParser, directory: WoffTableHeader[], totalSfntSize: number, flavor: number) {
    const sfntBuffer = new ArrayBuffer(totalSfntSize);
    const sfntView = new DataView(sfntBuffer);
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
    const tableDataArray: { header: WoffTableHeader, data: Uint8Array }[] = [];
    for (const tableHeader of directory) {
        parser.seek(tableHeader.offset);
        const compressedData = parser.getUint8Array(tableHeader.compLength);
        const tableData = tableHeader.compLength < tableHeader.origLength
            ? decompress(compressedData, new WOFFDeflate())
            : compressedData;

        if (tableData.length !== tableHeader.origLength) {
            throw new Error(`Table ${tableHeader.tag} decompressed to wrong size`);
        }

        tableDataArray.push({ header: tableHeader, data: tableData });
    }

    // Sort tables by tag as required by SFNT format
    tableDataArray.sort((a, b) => a.header.tag - b.header.tag);

    let tableOffset = sfntOffset + directory.length * 16;
    for (const { header, data } of tableDataArray) {
        sfntView.setUint32(sfntOffset, header.tag);
        sfntView.setUint32(sfntOffset + 4, 0); // checksum placeholder for now
        sfntView.setUint32(sfntOffset + 8, tableOffset);
        sfntView.setUint32(sfntOffset + 12, header.origLength);
        sfntOffset += 16;

        // Write table data
        const dest = new Uint8Array(sfntBuffer, tableOffset);
        dest.set(data);
        tableOffset += (header.origLength + 3) & ~3; // align to 4-byte boundary
    }

    return sfntBuffer;
}

export function parseWoff(buffer: ArrayBuffer): ArrayBuffer {
  const parser = new DataParser(buffer);
  const { flavor, numTables, totalSfntSize } = parseWoffHeader(parser);
  const directory = parseWoffDirectory(parser, numTables);
  return reconstructSfnt(parser, directory, totalSfntSize, flavor);
}
