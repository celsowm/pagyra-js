import type {
  BrotliOptions,
  BrotliResult,
  CompressionStats,
  DecompressOptions,
  WOFF2TableEntry,
} from './types.js';
import { BrotliMode } from './types.js';
import {
  toUint8Array,
  concatUint8Arrays,
  padTo4Bytes,
} from './utils.js';
import { WOFF2Transform } from './transform.js';

/**
 * Brotli compression/decompression module for WOFF 2.0
 *
 * WOFF 2.0 uses Brotli compression with:
 * - Quality level 0-11 (11 = maximum compression)
 * - Font-specific mode for better compression
 * - Optional table transformations
 */
export class WOFF2Brotli {
  private static readonly DEFAULT_QUALITY = 11; // Maximum compression for fonts
  private static readonly DEFAULT_MODE = BrotliMode.FONT;
  private static readonly DEFAULT_LGWIN = 22; // 4MB window
  private static readonly DEFAULT_LGBLOCK = 0; // Auto

  /**
   * Compress data using Brotli algorithm
   */
  static async compress(
    input: Uint8Array | ArrayBuffer,
    options: BrotliOptions = {}
  ): Promise<BrotliResult> {
    const data = toUint8Array(input);
    const quality = options.quality ?? this.DEFAULT_QUALITY;
    const mode = options.mode ?? this.DEFAULT_MODE;
    const lgwin = options.lgwin ?? this.DEFAULT_LGWIN;
    const lgblock = options.lgblock ?? this.DEFAULT_LGBLOCK;

    // Validate parameters
    if (quality < 0 || quality > 11) {
      throw new Error('Brotli quality must be between 0 and 11');
    }

    // Compress using available implementation
    const compressed = await this.brotliCompress(data, {
      quality,
      mode,
      lgwin,
      lgblock,
    });

    return {
      data: compressed,
      compressedSize: compressed.length,
      uncompressedSize: data.length,
    };
  }

  /**
   * Decompress Brotli data
   */
  static async decompress(
    input: Uint8Array | ArrayBuffer,
    options: DecompressOptions = {}
  ): Promise<Uint8Array> {
    const data = toUint8Array(input);

    // Decompress
    const decompressed = await this.brotliDecompress(data);

    // Validate size if expected
    if (options.expectedSize && options.validateSize) {
      if (decompressed.length !== options.expectedSize) {
        throw new Error(
          `Size mismatch: expected ${options.expectedSize}, got ${decompressed.length}`
        );
      }
    }

    return decompressed;
  }

  /**
   * Compress with table transformation (WOFF 2.0 specific)
   */
  static async compressWithTransform(
    input: Uint8Array,
    tableTag: string,
    entry: WOFF2TableEntry,
    options: BrotliOptions = {}
  ): Promise<BrotliResult> {
    // Apply transformation if applicable
    const transformed = WOFF2Transform.transform(tableTag, input, entry);
    const transformLength = WOFF2Transform.getTransformedLength(tableTag, input);

    // Compress transformed data
    const result = await this.compress(transformed, options);

    return {
      ...result,
      transformLength,
    };
  }

  /**
   * Decompress with reverse transformation (WOFF 2.0 specific)
   */
  static async decompressWithTransform(
    input: Uint8Array,
    tableTag: string,
    entry: WOFF2TableEntry,
    options: DecompressOptions = {}
  ): Promise<Uint8Array> {
    // Decompress
    const decompressed = await this.decompress(input, options);

    // Apply reverse transformation
    const untransformed = WOFF2Transform.untransform(tableTag, decompressed, entry);

    return untransformed;
  }

  /**
   * Get compression statistics
   */
  static getCompressionStats(
    original: Uint8Array,
    compressed: Uint8Array,
    transformed?: Uint8Array
  ): CompressionStats {
    return {
      originalSize: original.length,
      compressedSize: compressed.length,
      compressionRatio: compressed.length / original.length,
      transformedSize: transformed?.length,
      transformApplied: !!transformed && transformed.length !== original.length,
    };
  }

  /**
   * Platform-specific Brotli compression
   */
  private static async brotliCompress(
    data: Uint8Array,
    options: BrotliOptions
  ): Promise<Uint8Array> {
    // Try Node.js zlib first (has Brotli support in Node 11.7+)
    if (typeof process !== 'undefined' && process.versions?.node) {
      return this.nodeBrotliCompress(data, options);
    }

    // Try browser CompressionStream API (Brotli support)
    if (typeof CompressionStream !== 'undefined') {
      return this.browserBrotliCompress(data);
    }

    throw new Error('No Brotli implementation available');
  }

  /**
   * Platform-specific Brotli decompression
   */
  private static async brotliDecompress(data: Uint8Array): Promise<Uint8Array> {
    // Try Node.js zlib first
    if (typeof process !== 'undefined' && process.versions?.node) {
      return this.nodeBrotliDecompress(data);
    }

    // Try browser DecompressionStream API
    if (typeof DecompressionStream !== 'undefined') {
      return this.browserBrotliDecompress(data);
    }

    throw new Error('No Brotli implementation available');
  }

  /**
   * Node.js Brotli compression
   */
  private static async nodeBrotliCompress(
    data: Uint8Array,
    options: BrotliOptions
  ): Promise<Uint8Array> {
    const zlib = await import('zlib');
    const { promisify } = await import('util');
    const brotliCompress = promisify(zlib.brotliCompress);

    const params: Record<number, number> = {
      [zlib.constants.BROTLI_PARAM_QUALITY]: options.quality ?? this.DEFAULT_QUALITY,
      [zlib.constants.BROTLI_PARAM_MODE]: options.mode ?? this.DEFAULT_MODE,
    };

    if (options.lgwin !== undefined) {
      params[zlib.constants.BROTLI_PARAM_LGWIN] = options.lgwin;
    }

    if (options.lgblock !== undefined && options.lgblock > 0) {
      params[zlib.constants.BROTLI_PARAM_LGBLOCK] = options.lgblock;
    }

    const compressed = await brotliCompress(data, { params });
    return new Uint8Array(compressed);
  }

  /**
   * Node.js Brotli decompression
   */
  private static async nodeBrotliDecompress(data: Uint8Array): Promise<Uint8Array> {
    const zlib = await import('zlib');
    const { promisify } = await import('util');
    const brotliDecompress = promisify(zlib.brotliDecompress);

    const decompressed = await brotliDecompress(data);
    return new Uint8Array(decompressed);
  }

  /**
   * Browser Brotli compression using CompressionStream API
   */
  private static async browserBrotliCompress(data: Uint8Array): Promise<Uint8Array> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = new CompressionStream('br' as any);
    const writer = stream.writable.getWriter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writer.write(data as BufferSource);
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    return concatUint8Arrays(chunks);
  }

  /**
   * Browser Brotli decompression using DecompressionStream API
   */
  private static async browserBrotliDecompress(data: Uint8Array): Promise<Uint8Array> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = new DecompressionStream('br' as any);
    const writer = stream.writable.getWriter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writer.write(data as BufferSource);
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    return concatUint8Arrays(chunks);
  }

  /**
   * Validate Brotli compressed data
   */
  static async validateCompressedData(data: Uint8Array): Promise<boolean> {
    try {
      const decompressed = await this.decompress(data);
      return decompressed.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Compress multiple tables into single stream (WOFF 2.0 spec)
   */
  static async compressMultipleTables(
    tables: Array<{ tag: string; data: Uint8Array; entry: WOFF2TableEntry }>,
    options: BrotliOptions = {}
  ): Promise<BrotliResult> {
    // Concatenate all table data
    const concatenated = concatUint8Arrays(
      tables.map(({ data }) => padTo4Bytes(data))
    );

    // Compress as single stream (WOFF 2.0 optimization)
    return this.compress(concatenated, {
      ...options,
      mode: BrotliMode.FONT,
      quality: options.quality ?? 11,
    });
  }

  /**
   * Decompress single stream into multiple tables (WOFF 2.0 spec)
   */
  static async decompressMultipleTables(
    compressed: Uint8Array,
    tables: WOFF2TableEntry[],
    options: DecompressOptions = {}
  ): Promise<Map<string, Uint8Array>> {
    // Calculate expected total size
    const expectedSize = tables.reduce((sum, entry) => sum + entry.origLength, 0);

    // Decompress single stream
    const decompressed = await this.decompress(compressed, {
      ...options,
      expectedSize,
      validateSize: true,
    });

    // Split into individual tables
    const result = new Map<string, Uint8Array>();
    let offset = 0;

    for (const entry of tables) {
      const tableData = decompressed.slice(offset, offset + entry.origLength);

      // Apply reverse transformation if needed
      const final = WOFF2Transform.untransform(entry.tag, tableData, entry);

      result.set(entry.tag, final);
      offset += entry.origLength;

      // Skip padding
      const padding = (4 - (entry.origLength % 4)) % 4;
      offset += padding;
    }

    return result;
  }
}

// Export convenience functions
export const compress = WOFF2Brotli.compress.bind(WOFF2Brotli);
export const decompress = WOFF2Brotli.decompress.bind(WOFF2Brotli);
export const compressWithTransform = WOFF2Brotli.compressWithTransform.bind(WOFF2Brotli);
export const decompressWithTransform = WOFF2Brotli.decompressWithTransform.bind(WOFF2Brotli);
export const getCompressionStats = WOFF2Brotli.getCompressionStats.bind(WOFF2Brotli);
export const validateCompressedData = WOFF2Brotli.validateCompressedData.bind(WOFF2Brotli);
export const compressMultipleTables = WOFF2Brotli.compressMultipleTables.bind(WOFF2Brotli);
export const decompressMultipleTables = WOFF2Brotli.decompressMultipleTables.bind(WOFF2Brotli);
