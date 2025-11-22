import type { ImageInfo } from "./types.js";
import { WebpRiffParser } from "./webp-riff-parser.js";
import { Vp8lDecoder } from "./webp-vp8l-decoder.js";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface DecodeOptions {
  maxWidth?: number;
  maxHeight?: number;
  scale?: number;
}

// ============================================================================
// Constants
// ============================================================================

const TEXT_DECODER = new TextDecoder("ascii");

// ============================================================================
// DataReader Class
// ============================================================================

/**
 * Sequential binary data reader with automatic offset tracking
 */
export class DataReader {
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  public seek(offset: number): void {
    if (offset < 0 || offset > this.view.byteLength) {
      throw new RangeError(`Seek offset ${offset} out of bounds [0, ${this.view.byteLength}]`);
    }
    this.offset = offset;
  }

  public tell(): number {
    return this.offset;
  }

  public hasMore(): boolean {
    return this.offset < this.view.byteLength;
  }

  public getUint8(): number {
    this.checkBounds(1);
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  public getUint16(littleEndian: boolean = false): number {
    this.checkBounds(2);
    const value = this.view.getUint16(this.offset, littleEndian);
    this.offset += 2;
    return value;
  }

  public getUint32(littleEndian: boolean = false): number {
    this.checkBounds(4);
    const value = this.view.getUint32(this.offset, littleEndian);
    this.offset += 4;
    return value;
  }

  public getString(length: number): string {
    this.checkBounds(length);
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
    this.offset += length;
    return TEXT_DECODER.decode(bytes);
  }

  public getView(length: number): DataView {
    this.checkBounds(length);
    const view = new DataView(this.view.buffer, this.view.byteOffset + this.offset, length);
    this.offset += length;
    return view;
  }

  private checkBounds(length: number): void {
    if (this.offset + length > this.view.byteLength) {
      throw new RangeError(`Read beyond buffer bounds: ${this.offset + length} > ${this.view.byteLength}`);
    }
  }
}

/**
 * Reads individual bits from a DataView (LSB first)
 */
export class BitReader {
  private view: DataView;
  private bytePos: number = 0;
  private bitPos: number = 0;

  constructor(view: DataView) {
    this.view = view;
  }

  public readBits(n: number): number {
    if (n > 32) {
      throw new Error("Cannot read more than 32 bits at once");
    }

    let value = 0;
    for (let i = 0; i < n; i++) {
      if (this.bytePos >= this.view.byteLength) {
        // Pad with zeros if we run out of data (end of stream)
        return value;
      }

      const byte = this.view.getUint8(this.bytePos);
      const bit = (byte >> this.bitPos) & 1;
      value |= bit << i;

      this.bitPos++;
      if (this.bitPos === 8) {
        this.bitPos = 0;
        this.bytePos++;
      }
    }
    return value;
  }

  public hasMore(): boolean {
    return this.bytePos < this.view.byteLength;
  }

  // For debugging - peek at next bits without consuming them
  public peekBits(n: number): number {
    const oldBytePos = this.bytePos;
    const oldBitPos = this.bitPos;
    const value = this.readBits(n);
    this.bytePos = oldBytePos;
    this.bitPos = oldBitPos;
    return value;
  }
}

export abstract class BaseDecoder {

  protected static calculateDimensions(
    width: number,
    height: number,
    options: DecodeOptions
  ): { targetWidth: number; targetHeight: number } {
    let targetWidth = width;
    let targetHeight = height;

    if (options.scale && options.scale > 0) {
      targetWidth = Math.max(1, Math.round(width * options.scale));
      targetHeight = Math.max(1, Math.round(height * options.scale));
    } else if (options.maxWidth || options.maxHeight) {
      const scale = Math.min(
        options.maxWidth ? options.maxWidth / width : Infinity,
        options.maxHeight ? options.maxHeight / height : Infinity
      );

      if (scale > 0 && scale < 1) {
        targetWidth = Math.max(1, Math.round(width * scale));
        targetHeight = Math.max(1, Math.round(height * scale));
      }
    }

    return { targetWidth, targetHeight };
  }

  protected static resizeNN(
    src: Uint8Array,
    sw: number,
    sh: number,
    tw: number,
    th: number,
    channels: number,
  ): Uint8Array {
    if (sw === tw && sh === th) return src;

    const dst = new Uint8Array(tw * th * channels);
    const xRatio = sw / tw;
    const yRatio = sh / th;

    for (let y = 0; y < th; y++) {
      const sy = Math.min(sh - 1, Math.floor(y * yRatio));
      const srcRowOffset = sy * sw * channels;
      const dstRowOffset = y * tw * channels;

      for (let x = 0; x < tw; x++) {
        const sx = Math.min(sw - 1, Math.floor(x * xRatio));
        const si = srcRowOffset + sx * channels;
        const di = dstRowOffset + x * channels;

        for (let c = 0; c < channels; c++) {
          dst[di + c] = src[si + c];
        }
      }
    }
    return dst;
  }

  public abstract decode(buffer: ArrayBuffer, options?: DecodeOptions): Promise<ImageInfo>;
}

export class WebpDecoder extends BaseDecoder {
  private riffParser = new WebpRiffParser();
  private vp8lDecoder = new Vp8lDecoder();

  public async decode(
    buffer: ArrayBuffer,
    options: DecodeOptions = {},
  ): Promise<ImageInfo> {
    const reader = new DataReader(buffer);

    // Validate RIFF header
    this.riffParser.validateHeader(reader);

    // Parse chunks
    const chunks = this.riffParser.parseChunks(reader);

    // Determine format and decode
    const vp8xChunk = chunks.find(c => c.fourCC === 'VP8X');
    if (vp8xChunk) {
      return this.vp8lDecoder.decodeVp8x(vp8xChunk, chunks, options, WebpDecoder.calculateDimensions, WebpDecoder.resizeNN);
    }

    const vp8lChunk = chunks.find(c => c.fourCC === 'VP8L');
    if (vp8lChunk) {
      return this.vp8lDecoder.decodeVp8l(vp8lChunk, options, WebpDecoder.calculateDimensions, WebpDecoder.resizeNN);
    }

    const vp8Chunk = chunks.find(c => c.fourCC === 'VP8 ');
    if (vp8Chunk) {
      throw new Error("VP8 (lossy) WebP format is not yet supported");
    }

    throw new Error("Unsupported WebP format: No recognized image chunk found");
  }
}
