import { FontParser, FontTableData } from './base-parser';
import { decompress } from '../../compression/brotli/brotli';
import { reconstructGlyfTable } from '../transformers/woff2-transformer';

// Helper function to create a 4-byte tag from a string
function tag(s: string): number {
  return (s.charCodeAt(0) << 24) |
         (s.charCodeAt(1) << 16) |
         (s.charCodeAt(2) << 8) |
         s.charCodeAt(3);
}

const kKnownTags = [
  tag('cmap'), tag('head'), tag('hhea'), tag('hmtx'),
  tag('maxp'), tag('name'), tag('OS/2'), tag('post'),
  tag('cvt '), tag('fpgm'), tag('glyf'), tag('loca'),
  tag('prep'), tag('CFF '), tag('VORG'), tag('EBDT'),
  tag('EBLC'), tag('gasp'), tag('hdmx'), tag('kern'),
  tag('LTSH'), tag('PCLT'), tag('VDMX'), tag('vhea'),
  tag('vmtx'), tag('BASE'), tag('GDEF'), tag('GPOS'),
  tag('GSUB'), tag('EBSC'), tag('JSTF'), tag('MATH'),
  tag('CBDT'), tag('CBLC'), tag('COLR'), tag('CPAL'),
  tag('SVG '), tag('sbix'), tag('acnt'), tag('avar'),
  tag('bdat'), tag('bloc'), tag('bsln'), tag('cvar'),
  tag('fdsc'), tag('feat'), tag('fmtx'), tag('fvar'),
  tag('gvar'), tag('hsty'), tag('just'), tag('lcar'),
  tag('mort'), tag('morx'), tag('opbd'), tag('prop'),
  tag('trak'), tag('Zapf'), tag('Silf'), tag('Glat'),
  tag('Gloc'), tag('Feat'), tag('Sill'),
];


interface Woff2Header {
  signature: number;
  flavor: number;
  length: number;
  numTables: number;
  totalSfntSize: number;
  totalCompressedSize: number;
  majorVersion: number;
  minorVersion: number;
  metaOffset: number;
  metaLength: number;
  metaOrigLength: number;
  privOffset: number;
  privLength: number;
}

interface TableDirectoryEntry {
  tag: number;
  flags: number;
  transformLength: number;
  dstLength: number;
}

export class Woff2Parser implements FontParser {
  private data: Uint8Array = new Uint8Array(0);
  private view: DataView = new DataView(this.data.buffer);
  private offset: number = 0;

  public async parseTables(fontData: Uint8Array): Promise<FontTableData> {
    this.data = fontData;
    this.view = new DataView(fontData.buffer);
    this.offset = 0;

    const header = this.parseHeader();
    const tables = this.parseTableDirectory(header);

    const compressedDataOffset = this.offset;
    const compressedData = new Uint8Array(this.data.buffer, compressedDataOffset, header.totalCompressedSize);
    const uncompressedData = decompress(compressedData);

    const { glyf, loca } = reconstructGlyfTable(uncompressedData, new Uint8Array(0));

    return {
      flavor: header.flavor,
      tables: {
        'glyf': glyf,
        'loca': loca,
      },
    };
  }

  private readU8(): number {
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  private readU16(): number {
    const val = this.view.getUint16(this.offset, false);
    this.offset += 2;
    return val;
  }

  private readU32(): number {
    const val = this.view.getUint32(this.offset, false);
    this.offset += 4;
    return val;
  }

  private readBase128(): number {
    let result = 0;
    for (let i = 0; i < 5; i++) {
      const code = this.readU8();
      result = (result << 7) | (code & 0x7f);
      if ((code & 0x80) === 0) {
        return result;
      }
    }
    throw new Error('Invalid Base128 value');
  }

  private parseHeader(): Woff2Header {
    this.offset = 48; // Set offset to after the header for the next read
    return {
      signature: this.view.getUint32(0, false),
      flavor: this.view.getUint32(4, false),
      length: this.view.getUint32(8, false),
      numTables: this.view.getUint16(12, false),
      totalSfntSize: this.view.getUint32(16, false),
      totalCompressedSize: this.view.getUint32(20, false),
      majorVersion: this.view.getUint16(24, false),
      minorVersion: this.view.getUint16(26, false),
      metaOffset: this.view.getUint32(28, false),
      metaLength: this.view.getUint32(32, false),
      metaOrigLength: this.view.getUint32(36, false),
      privOffset: this.view.getUint32(40, false),
      privLength: this.view.getUint32(44, false),
    };
  }

  private parseTableDirectory(header: Woff2Header): TableDirectoryEntry[] {
    const tables: TableDirectoryEntry[] = [];
    for (let i = 0; i < header.numTables; i++) {
      const flagByte = this.readU8();
      const tagIndex = flagByte & 0x3f;
      let tag: number;
      if (tagIndex === 0x3f) {
        tag = this.readU32();
      } else {
        tag = kKnownTags[tagIndex];
      }

      const dstLength = this.readBase128();
      let transformLength = dstLength;

      const transformVersion = (flagByte >> 6) & 0x03;
      const isTransformed = (tag === 1735162214 || tag === 1819239265) ? transformVersion === 0 : transformVersion !== 0;

      if (isTransformed) {
        transformLength = this.readBase128();
      }

      tables.push({
        tag: tag,
        flags: transformVersion,
        dstLength: dstLength,
        transformLength: transformLength,
      });
    }
    return tables;
  }

  public getFormat(): string {
    return 'woff2';
  }
}
