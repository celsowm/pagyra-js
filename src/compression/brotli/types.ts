export interface BrotliOptions {
  quality?: number; // Compression quality 0-11 (default: 11)
  mode?: BrotliMode;
  lgwin?: number; // Window size (10-24)
  lgblock?: number; // Block size (16-24)
}

export enum BrotliMode {
  GENERIC = 0,
  TEXT = 1,
  FONT = 2, // Optimized for fonts (WOFF 2.0)
}

export interface BrotliResult {
  data: Uint8Array;
  compressedSize: number;
  uncompressedSize: number;
  transformLength?: number; // For transformed tables
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  transformedSize?: number;
  transformApplied: boolean;
}

export interface WOFF2TableEntry {
  tag: string;
  flags: number;
  transformVersion: number;
  transformLength?: number;
  origLength: number;
  origChecksum?: number;
}

export interface DecompressOptions {
  expectedSize?: number;
  validateSize?: boolean;
}

// WOFF 2.0 specific constants
export const WOFF2_CONSTANTS = {
  HEADER_SIZE: 48,
  TABLE_ENTRY_BASE_SIZE: 16,
  SIGNATURE: 'wOF2',
  MAX_TABLE_COUNT: 4096,
} as const;

// Known transform flags
export const TRANSFORM_FLAGS = {
  TRANSFORM_GLYF: 0x00,
  TRANSFORM_LOCA: 0x01,
  TRANSFORM_HMTX: 0x02,
  CONTINUE_STREAM: 0x10,
  RESERVED: 0x20,
} as const;
