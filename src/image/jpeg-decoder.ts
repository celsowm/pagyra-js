import type { ImageInfo } from "./types.js";
import { BaseDecoder, type DecodeOptions } from "./base-decoder.js";

/**
 * Minimal JPEG parser that extracts metadata and returns the original bytes.
 * The implementation does not perform full decoding; instead it surfaces the
 * intrinsic dimensions found in a Start Of Frame marker so the layout engine
 * can size the image correctly while keeping the compressed payload for embedding.
 */
export class JpegDecoder extends BaseDecoder {
  private static readonly SOI_MARKER = 0xffd8;
  private static readonly EOI_MARKER = 0xffd9;
  private static readonly SOS_MARKER = 0xffda;

  private static readonly SOF_MARKERS = new Set([
    0xffc0, // Baseline DCT
    0xffc1, // Extended sequential DCT
    0xffc2, // Progressive DCT
    0xffc3, // Lossless sequential
    0xffc5, // Differential sequential DCT
    0xffc6, // Differential progressive DCT
    0xffc7, // Differential lossless
    0xffc9, // Extended sequential DCT, arithmetic coding
    0xffca, // Progressive DCT, arithmetic coding
    0xffcb, // Lossless, arithmetic coding
    0xffcd, // Differential sequential DCT, arithmetic coding
    0xffce, // Differential progressive DCT, arithmetic coding
    0xffcf, // Differential lossless, arithmetic coding
  ]);

  public async decode(
    buffer: ArrayBuffer,
    options: DecodeOptions = {},
  ): Promise<ImageInfo> {
    const view = new DataView(buffer);

    if (buffer.byteLength < 4 || view.getUint16(0, false) !== JpegDecoder.SOI_MARKER) {
      throw new Error("Invalid JPEG: missing SOI marker");
    }

    let offset = 2;
    let width = 0;
    let height = 0;
    let channels = 3;
    let precision = 8;

    while (offset + 1 < buffer.byteLength) {
      if (view.getUint8(offset) !== 0xff) {
        offset++;
        continue;
      }

      while (offset < buffer.byteLength && view.getUint8(offset) === 0xff) {
        offset++;
      }
      if (offset >= buffer.byteLength) break;

      const marker = 0xff00 | view.getUint8(offset++);

      if (marker === JpegDecoder.EOI_MARKER || marker === JpegDecoder.SOS_MARKER) {
        break;
      }

      // Standalone markers do not carry a length field.
      if (marker === 0xff01 || (marker >= 0xffd0 && marker <= 0xffd7)) {
        continue;
      }

      if (offset + 2 > buffer.byteLength) {
        break;
      }

      const length = view.getUint16(offset, false);
      if (length < 2 || offset + length > buffer.byteLength) {
        throw new Error("Invalid JPEG: malformed segment length");
      }

      if (JpegDecoder.SOF_MARKERS.has(marker)) {
        if (length < 8) {
          throw new Error("Invalid JPEG: malformed SOF segment");
        }
        precision = view.getUint8(offset + 2);
        height = view.getUint16(offset + 3, false);
        width = view.getUint16(offset + 5, false);
        channels = view.getUint8(offset + 7);
        break;
      }

      offset += length;
    }

    if (width === 0 || height === 0) {
      throw new Error("Invalid JPEG: missing SOF marker");
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
