import type { ImageInfo } from "./types.js";

/**
 * Minimal JPEG parser that extracts metadata and returns the original bytes.
 * The implementation does not perform full decoding; instead it surfaces the
 * intrinsic dimensions found in the SOF0 marker so the layout engine can size
 * the image correctly while keeping the compressed payload for embedding.
 */
export class JpegDecoder {
  private static readonly SOI_MARKER = 0xffd8;
  private static readonly EOI_MARKER = 0xffd9;
  private static readonly SOF0_MARKER = 0xffc0;

  public static async decode(
    buffer: ArrayBuffer,
    options: { maxWidth?: number; maxHeight?: number; scale?: number } = {},
  ): Promise<ImageInfo> {
    const view = new DataView(buffer);

    if (view.getUint16(0, false) !== this.SOI_MARKER) {
      throw new Error("Invalid JPEG: missing SOI marker");
    }

    let offset = 2;
    let width = 0;
    let height = 0;
    let channels = 3;
    let precision = 8;

    while (offset + 4 < buffer.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;

      if (marker === this.EOI_MARKER) {
        break;
      }

      const length = view.getUint16(offset, false);

      if (marker === this.SOF0_MARKER) {
        precision = view.getUint8(offset + 2);
        height = view.getUint16(offset + 3, false);
        width = view.getUint16(offset + 5, false);
        channels = view.getUint8(offset + 7);
        break;
      }

      offset += length;
    }

    if (width === 0 || height === 0) {
      throw new Error("Invalid JPEG: missing SOF0 marker");
    }

    let targetWidth = width;
    let targetHeight = height;

    if (options.scale && options.scale > 0) {
      targetWidth = Math.max(1, Math.round(width * options.scale));
      targetHeight = Math.max(1, Math.round(height * options.scale));
    } else if (options.maxWidth || options.maxHeight) {
      const scale = Math.min(
        options.maxWidth ? options.maxWidth / width : 1,
        options.maxHeight ? options.maxHeight / height : 1,
      );
      if (scale > 0 && scale < 1) {
        targetWidth = Math.max(1, Math.round(width * scale));
        targetHeight = Math.max(1, Math.round(height * scale));
      }
    }

    const dataCopy = buffer.slice(0);

    return {
      width: targetWidth,
      height: targetHeight,
      format: "jpeg",
      channels,
      bitsPerChannel: precision,
      data: dataCopy,
    };
  }
}
