export interface DeflateOptions {
  level?: number; // Compression level 0-9
  windowBits?: number; // Size of compression window
}

export interface InflateOptions {
  windowBits?: number;
}

export interface DeflateResult {
  data: Uint8Array;
  compressedSize: number;
  uncompressedSize: number;
}

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  checksum: number;
}

export enum CompressionMethod {
  NONE = 0,
  DEFLATE = 8,
}
