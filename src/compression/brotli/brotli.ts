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

// Cache Node.js zlib module to avoid repeated imports
let nodeZlib: typeof import('zlib') | null = null;
let nodeUtil: typeof import('util') | null = null;

/**
 * Brotli compression/decompression module for WOFF 2.0
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

    if (quality < 0 || quality > 11) {
      throw new Error('Brotli quality must be between 0 and 11');
    }

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
    const decompressed = await this.brotliDecompress(data);

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
    const transformed = WOFF2Transform.transform(tableTag, input, entry);
    const transformLength = WOFF2Transform.getTransformedLength(tableTag, input);
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
    const decompressed = await this.decompress(input, options);
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
    if (typeof process !== 'undefined' && process.versions?.node) {
      return this.nodeBrotliCompress(data, options);
    }
    if (typeof CompressionStream !== 'undefined') {
      return this.browserBrotliCompress(data);
    }
    throw new Error('No Brotli implementation available (Platform not supported)');
  }

  /**
   * Platform-specific Brotli decompression
   */
  private static async brotliDecompress(data: Uint8Array): Promise<Uint8Array> {
    if (typeof process !== 'undefined' && process.versions?.node) {
      return this.nodeBrotliDecompress(data);
    }
    if (typeof DecompressionStream !== 'undefined') {
      return this.browserBrotliDecompress(data);
    }
    throw new Error('No Brotli implementation available (Platform not supported)');
  }

  /**
   * Node.js Brotli compression
   */
  private static async nodeBrotliCompress(
    data: Uint8Array,
    options: BrotliOptions
  ): Promise<Uint8Array> {
    if (!nodeZlib || !nodeUtil) {
      nodeZlib = await import('zlib');
      nodeUtil = await import('util');
    }

    const brotliCompress = nodeUtil.promisify(nodeZlib.brotliCompress);

    const params: Record<number, number> = {
      [nodeZlib.constants.BROTLI_PARAM_QUALITY]: options.quality ?? this.DEFAULT_QUALITY,
      [nodeZlib.constants.BROTLI_PARAM_MODE]: options.mode ?? this.DEFAULT_MODE,
    };

    if (options.lgwin !== undefined) {
      params[nodeZlib.constants.BROTLI_PARAM_LGWIN] = options.lgwin;
    }

    if (options.lgblock !== undefined && options.lgblock > 0) {
      params[nodeZlib.constants.BROTLI_PARAM_LGBLOCK] = options.lgblock;
    }

    const compressed = await brotliCompress(data, { params });
    return new Uint8Array(compressed);
  }

  /**
   * Node.js Brotli decompression
   */
  private static async nodeBrotliDecompress(data: Uint8Array): Promise<Uint8Array> {
    if (!nodeZlib || !nodeUtil) {
      nodeZlib = await import('zlib');
      nodeUtil = await import('util');
    }
    const brotliDecompress = nodeUtil.promisify(nodeZlib.brotliDecompress);

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

    // Forçamos o cast para BufferSource para evitar conflito com tipos do Node
    writer.write(data as BufferSource).catch(() => { /* ignore write errors here */ });
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
    } catch (e) {
      throw new Error('Browser Brotli compression failed: ' + e);
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

    writer.write(data as BufferSource).catch(() => { /* ignore */ });
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
    } catch (e) {
      throw new Error('Browser Brotli decompression failed: ' + e);
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
    const concatenated = concatUint8Arrays(
      tables.map(({ data }) => padTo4Bytes(data))
    );

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
    const expectedSize = tables.reduce((sum, entry) =>
      sum + (entry.transformLength ?? entry.origLength), 0);

    const decompressed = await this.decompress(compressed, {
      ...options,
      expectedSize,
      validateSize: false, // Don't validate size strictly due to padding
    });

    const result = new Map<string, Uint8Array>();
    let offset = 0;

    // First pass: extract all tables from the compressed stream
    console.log(`WOFF2-BROTLI: Extracting ${tables.length} tables from ${decompressed.length} bytes`);

    for (const entry of tables) {
      const lengthInStream = entry.transformLength ?? entry.origLength;

      console.log(`WOFF2-BROTLI: Processing table ${entry.tag} - origLength: ${entry.origLength}, transformLength: ${entry.transformLength}, transformVersion: ${entry.transformVersion}`);

      if (offset + lengthInStream > decompressed.length) {
        console.warn(`Table ${entry.tag} extends beyond decompressed data, using available data`);
        const availableData = decompressed.subarray(offset);
        if (availableData.length > 0) {
          result.set(entry.tag, availableData);
        }
        break;
      }

      const tableData = decompressed.subarray(offset, offset + lengthInStream);
      offset += lengthInStream;

      const final = WOFF2Transform.untransform(entry.tag, tableData, entry, result);
      result.set(entry.tag, final);
      console.log(`WOFF2-BROTLI: Added table ${entry.tag} (${final.length} bytes)`);
    }

    console.log(`WOFF2-BROTLI: Extracted tables: ${Array.from(result.keys()).join(', ')}`);

    // Second pass: handle glyf/loca transformation if gloc table exists
    if (result.has('gloc')) {
      console.log('WOFF2: Found gloc table, reconstructing glyf/loca');
      const glocData = result.get('gloc')!;
      console.log(`WOFF2: gloc data size: ${glocData.length} bytes`);

      // We need maxp table to get numGlyphs and head table to get indexToLocFormat
      const maxpData = result.get('maxp');
      const headData = result.get('head');

      console.log(`WOFF2: maxp table present: ${!!maxpData}, head table present: ${!!headData}`);

      if (maxpData && headData) {
        // Read numGlyphs from maxp table (offset 4, UInt16)
        const numGlyphs = new DataView(maxpData.buffer, maxpData.byteOffset).getUint16(4, false);

        // Read indexToLocFormat from head table (offset 50, Int16)
        const indexFormat = new DataView(headData.buffer, headData.byteOffset).getInt16(50, false);

        console.log(`WOFF2: Reconstructing glyf/loca with numGlyphs=${numGlyphs}, indexFormat=${indexFormat}`);

        // Reconstruct glyf and loca tables
        const { glyf, loca } = WOFF2Transform.reconstructGlyfLoca(glocData, numGlyphs, indexFormat);

        console.log(`WOFF2: Reconstructed glyf size: ${glyf.length}, loca size: ${loca.length}`);

        result.set('glyf', glyf);
        result.set('loca', loca);

        // Remove the gloc table as it's not part of standard TTF
        result.delete('gloc');
        console.log('WOFF2: Successfully reconstructed glyf/loca tables');
      } else {
        console.warn('Cannot reconstruct glyf/loca: missing maxp or head table');
      }
      console.log(`WOFF2: Available tables: ${Array.from(result.keys()).join(', ')}`);
    }

    // Third pass: reconstruct hmtx if needed
    this.reconstructHmtxIfNeeded(result, tables);

    return result;
  }

  /**
   * Helper to reconstruct hmtx table if needed
   */
  private static reconstructHmtxIfNeeded(
    result: Map<string, Uint8Array>,
    tables: WOFF2TableEntry[]
  ): void {
    const hmtxEntry = tables.find(t => t.tag === 'hmtx');
    if (!hmtxEntry || !result.has('hmtx')) return;

    // Check if hmtx is transformed (version 0 or 1 usually indicates transform in WOFF2)
    // But strictly, we should check if the data size matches the expected untransformed size.
    // If the data is smaller than expected, it's likely transformed.
    // Or we can check the flags byte if we assume it's transformed.

    // Better check: if transformVersion is 0, it IS transformed.
    if (hmtxEntry.transformVersion !== 0) return;

    const hmtxData = result.get('hmtx')!;
    const hheaData = result.get('hhea');
    const maxpData = result.get('maxp');

    if (!hheaData || !maxpData) {
      console.warn('WOFF2: Cannot reconstruct hmtx: missing hhea or maxp');
      return;
    }

    const numHMetrics = new DataView(hheaData.buffer, hheaData.byteOffset).getUint16(34, false);
    const numGlyphs = new DataView(maxpData.buffer, maxpData.byteOffset).getUint16(4, false);

    const reconstructed = WOFF2Transform.reconstructHmtx(hmtxData, numHMetrics, numGlyphs);
    result.set('hmtx', reconstructed);
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
