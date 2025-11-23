import type { ImageInfo } from "./types.js";
import { BaseDecoder, type DecodeOptions } from "./base-decoder.js";

export interface PngDecompressionStrategy {
  inflateRaw(data: Uint8Array): Promise<Uint8Array>;
  inflateZlib(data: Uint8Array): Promise<Uint8Array>;
}

type FilterType = 0 | 1 | 2 | 3 | 4;
type ColorType = 0 | 2 | 3 | 4 | 6;
type BitDepth = 1 | 2 | 4 | 8 | 16;

interface PngMetadata {
  width: number;
  height: number;
  bitDepth: BitDepth;
  colorType: ColorType;
  interlaceMethod: number;
  palette: Uint8Array | null;
  transparency: Uint8Array | null;
}

async function defaultInflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([data as any]).stream().pipeThrough(ds);
    const out = await new Response(stream).arrayBuffer();
    return new Uint8Array(out);
  } else {
    const { inflateRawSync } = await import('node:zlib');
    return inflateRawSync(data);
  }
}

async function defaultInflateZlib(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([data as any]).stream().pipeThrough(ds);
    const out = await new Response(stream).arrayBuffer();
    return new Uint8Array(out);
  } else {
    const { inflateSync } = await import('node:zlib');
    return inflateSync(data);
  }
}

// Extract sample from packed bits
function extractSample(bytes: Uint8Array, index: number, bitDepth: 1 | 2 | 4): number {
  const samplesPerByte = 8 / bitDepth;
  const byteIndex = Math.floor(index / samplesPerByte);
  const sampleOffset = index % samplesPerByte;
  const shift = 8 - bitDepth * (sampleOffset + 1);
  const mask = (1 << bitDepth) - 1;
  return (bytes[byteIndex] >> shift) & mask;
}

// Scale value from arbitrary bit depth to 8-bit
function scaleTo8bit(value: number, bitDepth: number): number {
  const maxValue = (1 << bitDepth) - 1;
  return Math.round((value / maxValue) * 255);
}

// Paeth predictor for filter type 4
function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}

/**
 * PNG decoder with improved error handling and performance
 */
export class PngDecoder extends BaseDecoder {
  private static readonly PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  private readonly decompression: PngDecompressionStrategy;

  constructor(decompression: Partial<PngDecompressionStrategy> = {}) {
    super();
    this.decompression = {
      inflateRaw: decompression.inflateRaw ?? defaultInflateRaw,
      inflateZlib: decompression.inflateZlib ?? defaultInflateZlib,
    };
  }

  public async decode(
    buffer: ArrayBuffer,
    options: DecodeOptions = {},
  ): Promise<ImageInfo> {
    const view = new DataView(buffer);

    // Validate PNG signature
    PngDecoder.validateSignature(view);

    // Parse chunks
    const { metadata, idatChunks } = PngDecoder.parseChunks(buffer, view);

    // Validate metadata
    PngDecoder.validateMetadata(metadata);

    // Decompress image data
    const decompressed = await this.decompressImageData(idatChunks);

    // Decode scanlines
    const pixelData = PngDecoder.decodeScanlines(decompressed, metadata);

    // Calculate target dimensions
    const { targetWidth, targetHeight } = PngDecoder.calculateDimensions(
      metadata.width,
      metadata.height,
      options
    );

    // Resize if needed
    const finalData = PngDecoder.resizeNN(
      pixelData,
      metadata.width,
      metadata.height,
      targetWidth,
      targetHeight,
      4
    );

    return {
      width: targetWidth,
      height: targetHeight,
      format: "png",
      channels: 4,
      bitsPerChannel: 8,
      data: finalData.buffer as ArrayBuffer,
    };
  }

  // --- Private Methods ---

  private static validateSignature(view: DataView): void {
    for (let i = 0; i < PngDecoder.PNG_SIGNATURE.length; i++) {
      if (view.getUint8(i) !== PngDecoder.PNG_SIGNATURE[i]) {
        throw new Error("Invalid PNG signature");
      }
    }
  }

  private static parseChunks(buffer: ArrayBuffer, view: DataView) {
    let offset = 8;
    const idatChunks: Uint8Array[] = [];
    const metadata: Partial<PngMetadata> = {
      palette: null,
      transparency: null,
    };

    let sawIDAT = false;
    let sawIEND = false;

    while (offset < buffer.byteLength) {
      if (offset + 8 > buffer.byteLength) {
        throw new Error("Incomplete chunk header");
      }

      const length = view.getUint32(offset, false);
      const type = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      );

      const dataOffset = offset + 8;

      if (offset + 12 + length > buffer.byteLength) {
        throw new Error(`Chunk ${type} extends beyond file boundary`);
      }

      switch (type) {
        case 'IHDR':
          PngDecoder.parseIHDR(view, dataOffset, metadata);
          break;
        case 'PLTE':
          if (sawIDAT) throw new Error("PLTE chunk must appear before IDAT");
          PngDecoder.parsePLTE(buffer, dataOffset, length, metadata);
          break;
        case 'tRNS':
          if (sawIDAT) throw new Error("tRNS chunk must appear before IDAT");
          PngDecoder.parseTRNS(buffer, dataOffset, length, metadata);
          break;
        case 'IDAT':
          sawIDAT = true;
          idatChunks.push(new Uint8Array(buffer, dataOffset, length));
          break;
        case 'IEND':
          sawIEND = true;
          offset += 12 + length;
          break;
        default:
          // Skip unknown chunks
          break;
      }

      if (sawIEND) break;
      offset += 12 + length;
    }

    if (!sawIEND) throw new Error("Missing IEND chunk");
    if (!sawIDAT) throw new Error("Missing IDAT chunk");

    return { metadata: metadata as PngMetadata, idatChunks };
  }

  private static parseIHDR(view: DataView, offset: number, metadata: Partial<PngMetadata>): void {
    metadata.width = view.getUint32(offset, false);
    metadata.height = view.getUint32(offset + 4, false);
    metadata.bitDepth = view.getUint8(offset + 8) as BitDepth;
    metadata.colorType = view.getUint8(offset + 9) as ColorType;

    const compressionMethod = view.getUint8(offset + 10);
    const filterMethod = view.getUint8(offset + 11);
    metadata.interlaceMethod = view.getUint8(offset + 12);

    if (compressionMethod !== 0) throw new Error("Unsupported compression method");
    if (filterMethod !== 0) throw new Error("Unsupported filter method");
  }

  private static parsePLTE(
    buffer: ArrayBuffer,
    offset: number,
    length: number,
    metadata: Partial<PngMetadata>
  ): void {
    if (length % 3 !== 0) throw new Error("Invalid PLTE chunk length");
    if (length / 3 > 256) throw new Error("PLTE has too many entries");
    metadata.palette = new Uint8Array(buffer, offset, length);
  }

  private static parseTRNS(
    buffer: ArrayBuffer,
    offset: number,
    length: number,
    metadata: Partial<PngMetadata>
  ): void {
    metadata.transparency = new Uint8Array(buffer, offset, length);
  }

  private static validateMetadata(metadata: PngMetadata): void {
    if (!metadata.width || !metadata.height) {
      throw new Error("Missing or invalid IHDR chunk");
    }
    if (metadata.colorType === 3 && !metadata.palette) {
      throw new Error("Indexed color PNG missing PLTE chunk");
    }
    if (metadata.interlaceMethod !== 0) {
      throw new Error("Interlaced PNGs are not supported");
    }

    // Validate bit depth for color type
    const validBitDepths: Record<ColorType, BitDepth[]> = {
      0: [1, 2, 4, 8, 16],
      2: [8, 16],
      3: [1, 2, 4, 8],
      4: [8, 16],
      6: [8, 16],
    };

    if (!validBitDepths[metadata.colorType]?.includes(metadata.bitDepth)) {
      throw new Error(
        `Invalid bit depth ${metadata.bitDepth} for color type ${metadata.colorType}`
      );
    }
  }

  private async decompressImageData(chunks: Uint8Array[]): Promise<Uint8Array> {
    // Concatenate all IDAT chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const compressed = new Uint8Array(totalLength);

    let offset = 0;
    for (const chunk of chunks) {
      compressed.set(chunk, offset);
      offset += chunk.length;
    }

    // Detect compression format and decompress
    const isZlib = (compressed[0] & 0x0F) === 0x08;

    try {
      return isZlib
        ? await this.decompression.inflateZlib(compressed)
        : await this.decompression.inflateRaw(compressed.slice(2, -4));
    } catch (error) {
      throw new Error(`Decompression failed: ${error}`);
    }
  }

  private static decodeScanlines(
    decompressed: Uint8Array,
    metadata: PngMetadata
  ): Uint8Array {
    const { width, height, bitDepth, colorType } = metadata;

    const channels = PngDecoder.getChannelCount(colorType);
    const bitsPerPixel = bitDepth * channels;
    const bytesPerRow = Math.ceil((bitsPerPixel * width) / 8);
    const bytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));

    const pixelData = new Uint8Array(width * height * 4);
    let prevRow: Uint8Array = new Uint8Array(bytesPerRow);
    let offset = 0;

    for (let y = 0; y < height; y++) {
      // Read filter type
      const filterType = decompressed[offset++] as FilterType;

      // Read scanline
      const scanline = decompressed.subarray(offset, offset + bytesPerRow);
      offset += bytesPerRow;

      // Reconstruct filtered row
      const currentRow = PngDecoder.reconstructRow(
        scanline,
        prevRow,
        filterType,
        bytesPerPixel
      );

      // Convert to RGBA
      PngDecoder.convertRowToRGBA(
        currentRow,
        pixelData,
        y,
        width,
        metadata
      );

      prevRow = currentRow;
    }

    return pixelData;
  }

  private static getChannelCount(colorType: ColorType): number {
    const channelMap: Record<ColorType, number> = {
      0: 1, // Grayscale
      2: 3, // RGB
      3: 1, // Indexed
      4: 2, // Grayscale + Alpha
      6: 4, // RGBA
    };
    return channelMap[colorType];
  }

  private static reconstructRow(
    scanline: Uint8Array,
    prevRow: Uint8Array,
    filterType: FilterType,
    bpp: number
  ): Uint8Array {
    const row = new Uint8Array(scanline.length);

    for (let i = 0; i < scanline.length; i++) {
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = prevRow[i];
      const upLeft = i >= bpp ? prevRow[i - bpp] : 0;

      let value: number;
      switch (filterType) {
        case 0: // None
          value = scanline[i];
          break;
        case 1: // Sub
          value = scanline[i] + left;
          break;
        case 2: // Up
          value = scanline[i] + up;
          break;
        case 3: // Average
          value = scanline[i] + ((left + up) >>> 1);
          break;
        case 4: // Paeth
          value = scanline[i] + paethPredictor(left, up, upLeft);
          break;
        default:
          throw new Error(`Invalid filter type: ${filterType}`);
      }

      row[i] = value & 0xFF;
    }

    return row;
  }

  private static convertRowToRGBA(
    row: Uint8Array,
    pixelData: Uint8Array,
    y: number,
    width: number,
    metadata: PngMetadata
  ): void {
    const { colorType, bitDepth, palette, transparency } = metadata;

    switch (colorType) {
      case 0: // Grayscale
        PngDecoder.convertGrayscale(row, pixelData, y, width, bitDepth, transparency);
        break;
      case 2: // RGB
        PngDecoder.convertRGB(row, pixelData, y, width, bitDepth, transparency);
        break;
      case 3: // Indexed
        PngDecoder.convertIndexed(row, pixelData, y, width, bitDepth, palette!, transparency);
        break;
      case 4: // Grayscale + Alpha
        PngDecoder.convertGrayscaleAlpha(row, pixelData, y, width, bitDepth);
        break;
      case 6: // RGBA
        PngDecoder.convertRGBA(row, pixelData, y, width, bitDepth);
        break;
    }
  }

  private static convertGrayscale(
    row: Uint8Array,
    pixelData: Uint8Array,
    y: number,
    width: number,
    bitDepth: BitDepth,
    transparency: Uint8Array | null
  ): void {
    for (let x = 0; x < width; x++) {
      let gray: number;

      if (bitDepth === 8) {
        gray = row[x];
      } else if (bitDepth === 16) {
        gray = row[x * 2]; // Use high byte
      } else {
        const sample = extractSample(row, x, bitDepth as 1 | 2 | 4);
        gray = scaleTo8bit(sample, bitDepth);
      }

      const offset = (y * width + x) * 4;
      pixelData[offset] = gray;
      pixelData[offset + 1] = gray;
      pixelData[offset + 2] = gray;
      pixelData[offset + 3] = (transparency && gray === transparency[1]) ? 0 : 255;
    }
  }

  private static convertRGB(
    row: Uint8Array,
    pixelData: Uint8Array,
    y: number,
    width: number,
    bitDepth: BitDepth,
    transparency: Uint8Array | null
  ): void {
    const bytesPerPixel = bitDepth === 16 ? 6 : 3;
    const step = bitDepth === 16 ? 2 : 1;

    for (let x = 0; x < width; x++) {
      const srcOffset = x * bytesPerPixel;
      const dstOffset = (y * width + x) * 4;

      const r = row[srcOffset];
      const g = row[srcOffset + step];
      const b = row[srcOffset + step * 2];

      pixelData[dstOffset] = r;
      pixelData[dstOffset + 1] = g;
      pixelData[dstOffset + 2] = b;

      // Check transparency
      const isTransparent = transparency &&
        r === transparency[1] &&
        g === transparency[3] &&
        b === transparency[5];

      pixelData[dstOffset + 3] = isTransparent ? 0 : 255;
    }
  }

  private static convertIndexed(
    row: Uint8Array,
    pixelData: Uint8Array,
    y: number,
    width: number,
    bitDepth: BitDepth,
    palette: Uint8Array,
    transparency: Uint8Array | null
  ): void {
    for (let x = 0; x < width; x++) {
      const index = bitDepth === 8
        ? row[x]
        : extractSample(row, x, bitDepth as 1 | 2 | 4);

      const paletteOffset = index * 3;
      const pixelOffset = (y * width + x) * 4;

      pixelData[pixelOffset] = palette[paletteOffset];
      pixelData[pixelOffset + 1] = palette[paletteOffset + 1];
      pixelData[pixelOffset + 2] = palette[paletteOffset + 2];
      pixelData[pixelOffset + 3] =
        (transparency && index < transparency.length) ? transparency[index] : 255;
    }
  }

  private static convertGrayscaleAlpha(
    row: Uint8Array,
    pixelData: Uint8Array,
    y: number,
    width: number,
    bitDepth: BitDepth
  ): void {
    const bytesPerPixel = bitDepth === 16 ? 4 : 2;
    const step = bitDepth === 16 ? 2 : 1;

    for (let x = 0; x < width; x++) {
      const srcOffset = x * bytesPerPixel;
      const dstOffset = (y * width + x) * 4;

      const gray = row[srcOffset];
      const alpha = row[srcOffset + step];

      pixelData[dstOffset] = gray;
      pixelData[dstOffset + 1] = gray;
      pixelData[dstOffset + 2] = gray;
      pixelData[dstOffset + 3] = alpha;
    }
  }

  private static convertRGBA(
    row: Uint8Array,
    pixelData: Uint8Array,
    y: number,
    width: number,
    bitDepth: BitDepth
  ): void {
    const bytesPerPixel = bitDepth === 16 ? 8 : 4;
    const step = bitDepth === 16 ? 2 : 1;

    for (let x = 0; x < width; x++) {
      const srcOffset = x * bytesPerPixel;
      const dstOffset = (y * width + x) * 4;

      pixelData[dstOffset] = row[srcOffset];
      pixelData[dstOffset + 1] = row[srcOffset + step];
      pixelData[dstOffset + 2] = row[srcOffset + step * 2];
      pixelData[dstOffset + 3] = row[srcOffset + step * 3];
    }
  }

}
