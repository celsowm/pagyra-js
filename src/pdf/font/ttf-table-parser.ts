/**
 * TtfTableParser
 * Small utility to read table directory and provide safe big-endian reads.
 *
 * This file was extracted from ttf-lite.ts as part of SRP refactor. Keep the
 * implementation minimal and focused on DataView/table-directory logic.
 */

export interface TableDirectoryEntry {
  tag: number;
  checksum: number;
  offset: number;
  length: number;
}

export class TtfTableParser {
  private readonly dataView: DataView;
  private readonly tableDirectory = new Map<number, TableDirectoryEntry>();

  constructor(buffer: ArrayBuffer) {
    this.dataView = new DataView(buffer);
    this.parseTableDirectory();
  }

  private parseTableDirectory(): void {
    // Validate minimal header present
    if (this.dataView.byteLength < 12) {
      throw new Error("Truncated TTF header");
    }

    const numTables = this.dataView.getUint16(4, false); // big-endian
    const tableDirOffset = 12;
    const requiredDirBytes = tableDirOffset + numTables * 16;
    if (requiredDirBytes > this.dataView.byteLength) {
      throw new Error("Truncated table directory");
    }

    for (let i = 0; i < numTables; i++) {
      const offset = tableDirOffset + i * 16;
      const tag = this.dataView.getUint32(offset, false);
      const checksum = this.dataView.getUint32(offset + 4, false);
      const tableOffset = this.dataView.getUint32(offset + 8, false);
      const length = this.dataView.getUint32(offset + 12, false);

      // Validate table bounds relative to file length
      if (tableOffset + length > this.dataView.byteLength) {
        throw new Error(
          `Invalid table range for tag 0x${tag.toString(16)}: offset ${tableOffset} + length ${length} exceeds file size`
        );
      }

      this.tableDirectory.set(tag, {
        tag,
        checksum,
        offset: tableOffset,
        length
      });
    }
  }

  getTable(tag: number): DataView | null {
    const entry = this.tableDirectory.get(tag);
    if (!entry) return null;

    // Extra guard for safety before creating a DataView
    if (entry.offset + entry.length > this.dataView.byteLength) {
      throw new Error(`Invalid table entry for tag 0x${tag.toString(16)}`);
    }

    return new DataView(this.dataView.buffer, entry.offset, entry.length);
  }

  getUint16(table: DataView, offset: number): number {
    if (offset + 2 > table.byteLength) throw new Error("Read beyond table bounds (getUint16)");
    return table.getUint16(offset, false); // big-endian
  }

  getInt16(table: DataView, offset: number): number {
    if (offset + 2 > table.byteLength) throw new Error("Read beyond table bounds (getInt16)");
    return table.getInt16(offset, false); // big-endian
  }

  getUint32(table: DataView, offset: number): number {
    if (offset + 4 > table.byteLength) throw new Error("Read beyond table bounds (getUint32)");
    return table.getUint32(offset, false); // big-endian
  }
}
