// Base parser interface for all font formats
export interface FontTableData {
  flavor: number;
  tables: Record<string, Uint8Array>;
  compressionInfo?: CompressionInfo;
}

export interface CompressionInfo {
  type: 'none' | 'woff' | 'woff2';
  tables: Map<string, TableCompressionInfo>;
}

export interface TableCompressionInfo {
  compressed: boolean;
  originalLength?: number;
  compressedLength?: number;
}

// Generic font parser interface
export interface FontParser<T extends FontTableData = FontTableData> {
  parseTables(fontData: Uint8Array): Promise<T>;
  getFormat(): string;
}
