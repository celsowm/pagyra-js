import { inflateSync } from "zlib";
import type { ParsedFont } from "../types.js";

const WOFF_SIGNATURE = 0x774f4646; // "wOFF"
const WOFF_HEADER_SIZE = 44;
const TABLE_DIR_ENTRY_SIZE = 20;

function readUInt32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function readUInt16(view: DataView, offset: number): number {
  return view.getUint16(offset, false);
}

function tagToString(tag: number): string {
  return String.fromCharCode(
    (tag >> 24) & 0xff,
    (tag >> 16) & 0xff,
    (tag >> 8) & 0xff,
    tag & 0xff
  );
}

/**
 * Decode a WOFF 1.0 font into raw sfnt table data.
 * SRP: only responsible for WOFF container parsing + per-table decompression.
 */
export function decodeWoff(fontData: Uint8Array): ParsedFont {
  if (fontData.byteLength < WOFF_HEADER_SIZE) {
    throw new Error("Invalid WOFF: file too short");
  }

  const view = new DataView(
    fontData.buffer,
    fontData.byteOffset,
    fontData.byteLength
  );

  const signature = readUInt32(view, 0);
  if (signature !== WOFF_SIGNATURE) {
    throw new Error("Invalid WOFF signature");
  }

  const flavor = readUInt32(view, 4) >>> 0;
  const reportedLength = readUInt32(view, 8);
  if (reportedLength !== fontData.byteLength) {
    throw new Error("Invalid WOFF: length mismatch");
  }

  const numTables = readUInt16(view, 12);
  const totalSfntSize = readUInt32(view, 16);
  if (numTables === 0 || totalSfntSize === 0) {
    throw new Error("Invalid WOFF: missing tables");
  }

  const directoryOffset = WOFF_HEADER_SIZE;
  const directoryLength = numTables * TABLE_DIR_ENTRY_SIZE;
  if (directoryOffset + directoryLength > fontData.byteLength) {
    throw new Error("Invalid WOFF: truncated directory");
  }

  const tables: Record<string, Uint8Array> = {};

  for (let i = 0; i < numTables; i++) {
    const entryOffset = directoryOffset + i * TABLE_DIR_ENTRY_SIZE;
    const tag = readUInt32(view, entryOffset);
    const offset = readUInt32(view, entryOffset + 4);
    const compLength = readUInt32(view, entryOffset + 8);
    const origLength = readUInt32(view, entryOffset + 12);

    if (offset + compLength > fontData.byteLength) {
      throw new Error("Invalid WOFF: table outside bounds");
    }

    const compressedSlice = fontData.subarray(offset, offset + compLength);
    let tableData: Uint8Array;
    if (compLength !== origLength) {
      const inflated = inflateSync(compressedSlice);
      if (inflated.byteLength !== origLength) {
        throw new Error("Invalid WOFF: decompressed size mismatch");
      }
      tableData = new Uint8Array(inflated);
    } else {
      // Copy to avoid sharing the original buffer
      tableData = new Uint8Array(origLength);
      tableData.set(compressedSlice.subarray(0, origLength));
    }

    const tagString = tagToString(tag);
    tables[tagString] = tableData;
  }

  return {
    flavor,
    numTables,
    tables,
  };
}
