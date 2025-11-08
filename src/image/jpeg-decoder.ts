import type { ImageInfo } from "./types.js";
import { BaseDecoder, type DecodeOptions } from "./base-decoder.js";

/**
 * Minimal JPEG parser that extracts metadata and returns the original bytes.
 * The implementation does not perform full decoding; instead it surfaces the
 * intrinsic dimensions found in the SOF0 marker so the layout engine can size
 * the image correctly while keeping the compressed payload for embedding.
 */
export class JpegDecoder extends BaseDecoder {
  private static readonly SOI_MARKER = 0xffd8;
  private static readonly EOI_MARKER = 0xffd9;
  private static readonly SOF0_MARKER = 0xffc0;

  public async decode(
    buffer: ArrayBuffer,
    options: DecodeOptions = {},
  ): Promise<ImageInfo> {
    const view = new DataView(buffer);

    if (view.getUint16(0, false) !== JpegDecoder.SOI_MARKER) {
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

      if (marker === JpegDecoder.EOI_MARKER) {
        break;
      }

      const length = view.getUint16(offset, false);

      if (marker === JpegDecoder.SOF0_MARKER) {
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

    const { targetWidth, targetHeight } = JpegDecoder.calculateDimensions(
      width,
      height,
      options
    );

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
