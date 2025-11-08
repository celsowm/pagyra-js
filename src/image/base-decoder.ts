import type { ImageInfo } from "./types.js";

export interface DecodeOptions {
  maxWidth?: number;
  maxHeight?: number;
  scale?: number;
}

export class DataReader {
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  public seek(offset: number): void {
    this.offset = offset;
  }

  public tell(): number {
    return this.offset;
  }

  public hasMore(): boolean {
    return this.offset < this.view.byteLength;
  }

  public getUint8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  public getUint16(littleEndian: boolean = false): number {
    const value = this.view.getUint16(this.offset, littleEndian);
    this.offset += 2;
    return value;
  }

  public getUint32(littleEndian: boolean = false): number {
    const value = this.view.getUint32(this.offset, littleEndian);
    this.offset += 4;
    return value;
  }

  public getString(length: number): string {
    let str = "";
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(this.getUint8());
    }
    return str;
  }

  public getView(length: number): DataView {
    const view = new DataView(this.view.buffer, this.view.byteOffset + this.offset, length);
    this.offset += length;
    return view;
  }
}

export class BitReader {
  private view: DataView;
  private bytePos: number = 0;
  private bitPos: number = 0;

  constructor(view: DataView) {
    this.view = view;
  }

  public readBits(n: number): number {
    let value = 0;
    for (let i = 0; i < n; i++) {
      if (this.bytePos >= this.view.byteLength) return value;
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

  // Optimized nearest-neighbor resize
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
