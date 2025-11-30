import { Adler32 } from './adler32.js';
import type {
  DeflateOptions,
  InflateOptions,
  DeflateResult,
  CompressionStats,
} from './types.js';
import { CompressionMethod } from './types.js';
import {
  writeUInt32BE,
  readUInt32BE,
  concatUint8Arrays,
  toUint8Array,
} from './utils.js';

/**
 * DEFLATE compression/decompression module for WOFF 1.0
 *
 * WOFF 1.0 uses zlib-compressed data, which consists of:
 * - 2-byte zlib header
 * - DEFLATE-compressed data
 * - 4-byte Adler-32 checksum
 */
export class WOFFDeflate {
  private static readonly ZLIB_HEADER_CM_DEFLATE = 0x78; // CMF byte for DEFLATE
  private static readonly DEFAULT_COMPRESSION_LEVEL = 6;

  /**
   * Compress data using DEFLATE algorithm (zlib format for WOFF)
   */
  static async compress(
    input: Uint8Array | ArrayBuffer,
    options: DeflateOptions = {}
  ): Promise<DeflateResult> {
    const data = toUint8Array(input);
    const level = options.level ?? this.DEFAULT_COMPRESSION_LEVEL;

    // Compress using available implementation
    const compressed = await this.deflateCompress(data, level);

    // Create zlib format: header + compressed data + checksum
    const zlibData = this.wrapWithZlibFormat(compressed, data);

    return {
      data: zlibData,
      compressedSize: zlibData.length,
      uncompressedSize: data.length,
    };
  }

  /**
   * Decompress DEFLATE data (zlib format)
   */
  static async decompress(
    input: Uint8Array | ArrayBuffer,
    _options: InflateOptions = {}
  ): Promise<Uint8Array> {
    const data = toUint8Array(input);

    // Verify and strip zlib wrapper
    const { compressed, checksum } = this.unwrapZlibFormat(data);

    // Decompress
    const decompressed = await this.deflateDecompress(compressed);

    // Verify checksum
    const calculatedChecksum = Adler32.calculate(decompressed);
    if (calculatedChecksum !== checksum) {
      throw new Error(
        `Adler-32 checksum mismatch: expected ${checksum}, got ${calculatedChecksum}`
      );
    }

    return decompressed;
  }

  /**
   * Get compression statistics
   */
  static getCompressionStats(
    original: Uint8Array,
    compressed: Uint8Array
  ): CompressionStats {
    return {
      originalSize: original.length,
      compressedSize: compressed.length,
      compressionRatio: compressed.length / original.length,
      checksum: Adler32.calculate(original),
    };
  }

  /**
   * Wrap compressed data with zlib format header and checksum
   */
  private static wrapWithZlibFormat(
    compressed: Uint8Array,
    original: Uint8Array
  ): Uint8Array {
    const checksum = Adler32.calculate(original);
    const result = new Uint8Array(compressed.length + 6);

    // Zlib header (2 bytes)
    // CMF (Compression Method and flags)
    const cmf = 0x78; // DEFLATE with 32K window

    // FLG (Flags)
    let flg = 0x9c; // Default compression

    // Ensure (CMF * 256 + FLG) is a multiple of 31
    const fcheck = 31 - ((cmf * 256 + flg) % 31);
    flg = (flg & 0xe0) | fcheck;

    result[0] = cmf;
    result[1] = flg;

    // Compressed data
    result.set(compressed, 2);

    // Adler-32 checksum (4 bytes, big-endian)
    writeUInt32BE(checksum, result, result.length - 4);

    return result;
  }

  /**
   * Unwrap zlib format to get compressed data and checksum
   */
  private static unwrapZlibFormat(data: Uint8Array): {
    compressed: Uint8Array;
    checksum: number;
    uncompressedSize: number;
  } {
    if (data.length < 6) {
      throw new Error('Invalid zlib data: too short');
    }

    // Verify zlib header
    const cmf = data[0];
    const flg = data[1];

    // Check compression method
    const cm = cmf & 0x0f;
    if (cm !== CompressionMethod.DEFLATE) {
      throw new Error(`Unsupported compression method: ${cm}`);
    }

    // Verify header checksum
    if ((cmf * 256 + flg) % 31 !== 0) {
      throw new Error('Invalid zlib header checksum');
    }

    // Extract compressed data (between header and checksum)
    const compressed = data.slice(2, -4);

    // Extract Adler-32 checksum
    const checksum = readUInt32BE(data, data.length - 4);

    return {
      compressed,
      checksum,
      uncompressedSize: 0, // Unknown until decompressed
    };
  }

  /**
   * Platform-specific DEFLATE compression
   */
  private static async deflateCompress(
    data: Uint8Array,
    level: number
  ): Promise<Uint8Array> {
    // Try browser CompressionStream API
    if (typeof CompressionStream !== 'undefined') {
      return this.browserDeflateCompress(data);
    }

    // Fallback to Node zlib when available
    if (typeof process !== 'undefined' && process.versions?.node) {
      return this.nodeDeflateCompress(data, level);
    }

    throw new Error('No DEFLATE implementation available');
  }

  /**
   * Platform-specific DEFLATE decompression
   */
  private static async deflateDecompress(data: Uint8Array): Promise<Uint8Array> {
    // Try browser DecompressionStream API
    if (typeof DecompressionStream !== 'undefined') {
      return this.browserDeflateDecompress(data);
    }

    // Fallback to Node zlib when available
    if (typeof process !== 'undefined' && process.versions?.node) {
      return this.nodeDeflateDecompress(data);
    }

    throw new Error('No DEFLATE implementation available');
  }

  /**
   * Node.js DEFLATE compression using zlib
   */
  private static async nodeDeflateCompress(
    data: Uint8Array,
    level: number
  ): Promise<Uint8Array> {
    const zlib = await import('zlib');
    const { promisify } = await import('util');
    const deflateRaw = promisify(zlib.deflateRaw);

    const compressed = await deflateRaw(data, {
      level,
      windowBits: 15,
    });

    return new Uint8Array(compressed);
  }

  /**
   * Node.js DEFLATE decompression using zlib
   */
  private static async nodeDeflateDecompress(data: Uint8Array): Promise<Uint8Array> {
    const zlib = await import('zlib');
    const { promisify } = await import('util');
    const inflateRaw = promisify(zlib.inflateRaw);

    const decompressed = await inflateRaw(data, {
      windowBits: 15,
    });

    return new Uint8Array(decompressed);
  }

  /**
   * Browser DEFLATE compression using CompressionStream API
   */
  private static async browserDeflateCompress(data: Uint8Array): Promise<Uint8Array> {
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
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
   * Browser DEFLATE decompression using DecompressionStream API
   */
  private static async browserDeflateDecompress(data: Uint8Array): Promise<Uint8Array> {
    const stream = new DecompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
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
   * Validate WOFF compressed data
   */
  static validateCompressedData(data: Uint8Array): boolean {
    try {
      const { compressed, checksum } = this.unwrapZlibFormat(data);
      return compressed.length > 0 && checksum > 0;
    } catch {
      return false;
    }
  }
}

// Export convenience functions
export const compress = WOFFDeflate.compress.bind(WOFFDeflate);
export const decompress = WOFFDeflate.decompress.bind(WOFFDeflate);
export const getCompressionStats = WOFFDeflate.getCompressionStats.bind(WOFFDeflate);
export const validateCompressedData = WOFFDeflate.validateCompressedData.bind(WOFFDeflate);
