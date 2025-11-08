import type { ImageInfo } from "./types.js";

export interface DecodeOptions {
  maxWidth?: number;
  maxHeight?: number;
  scale?: number;
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
