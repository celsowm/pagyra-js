import type { ImageInfo } from "./types.js";

interface RiffChunk {
  fourCC: string;
  size: number;
  data: DataView;
}

export class WebpDecoder {
  public static async decode(
    buffer: ArrayBuffer,
    options: { maxWidth?: number; maxHeight?: number; scale?: number } = {},
  ): Promise<ImageInfo> {
    const view = new DataView(buffer);

    // Check for 'RIFF' and 'WEBP' signatures
    if (view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57454250) {
      throw new Error("Invalid WebP file format");
    }

    let offset = 12;
    const chunks: RiffChunk[] = [];

    while (offset < buffer.byteLength) {
      const fourCC = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      const size = view.getUint32(offset + 4, true);
      const data = new DataView(buffer, offset + 8, size);

      chunks.push({ fourCC, size, data });

      offset += 8 + size;
      if (size % 2 !== 0) {
        offset++;
      }
    }

    const vp8xChunk = chunks.find(c => c.fourCC === 'VP8X');
    const vp8lChunk = chunks.find(c => c.fourCC === 'VP8L');
    const vp8Chunk = chunks.find(c => c.fourCC === 'VP8 ');

    if (vp8xChunk) {
      // Extended WebP format
      const width = 1 + vp8xChunk.data.getUint32(4, true) & 0xFFFFFF;
      const height = 1 + vp8xChunk.data.getUint32(7, true) & 0xFFFFFF;

      if (vp8lChunk) {
        // Lossless
        return this.decodeVp8l(vp8lChunk, width, height);
      } else if (vp8Chunk) {
        // Lossy
        return this.decodeVp8(vp8Chunk, width, height);
      } else {
        throw new Error("Invalid WebP file: missing VP8L or VP8 chunk");
      }
    } else {
      // Simple WebP format
      if (vp8lChunk) {
        // Lossless
        const { width, height } = this.getVp8lDimensions(vp8lChunk.data);
        return this.decodeVp8l(vp8lChunk, width, height);
      } else if (vp8Chunk) {
        // Lossy
        const { width, height } = this.getVp8Dimensions(vp8Chunk.data);
        return this.decodeVp8(vp8Chunk, width, height);
      } else {
        throw new Error("Invalid WebP file: missing VP8L or VP8 chunk");
      }
    }
  }

  private static getVp8Dimensions(data: DataView): { width: number; height: number } {
    const width = data.getUint16(6, true) & 0x3fff;
    const height = data.getUint16(8, true) & 0x3fff;
    return { width, height };
  }

  private static getVp8lDimensions(data: DataView): { width: number; height: number } {
    if (data.getUint8(0) !== 0x2f) {
      throw new Error("Invalid VP8L bitstream signature");
    }
    const bits = data.getUint32(1, true);
    const width = 1 + (bits & 0x3FFF);
    const height = 1 + ((bits >> 14) & 0x3FFF);
    return { width, height };
  }

  private static decodeVp8l(chunk: RiffChunk, width: number, height: number): ImageInfo {
    const bitReader = new BitReader(chunk.data);
    const decodedData = new Uint8Array(width * height * 4);

    // VP8L signature
    if (bitReader.readBits(8) !== 0x2f) {
      throw new Error("Invalid VP8L signature");
    }

    // Dimensions (already known from simple/extended format)
    bitReader.readBits(28);

    // Transform info
    const isTransform = bitReader.readBit();
    if (isTransform) {
      // Skip transform data for now
      bitReader.readBits(4);
      const transformType = bitReader.readBits(2);
      if (transformType === 0) { // Predictor
        bitReader.readBits(8); // size_bits
      } else if (transformType === 1) { // Color
        bitReader.readBits(8); // size_bits
      }
    }

    // Read Huffman codes
    const numCodeLengthCodes = 4 + bitReader.readBits(4);
    const codeLengthCodeLengths = new Array(19).fill(0);
    const codeLengthOrder = [17, 18, 0, 1, 2, 3, 4, 5, 16, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    for (let i = 0; i < numCodeLengthCodes; i++) {
      codeLengthCodeLengths[codeLengthOrder[i]] = bitReader.readBits(3);
    }

    const huffmanTable = this.buildHuffmanTable(codeLengthCodeLengths);

    const huffmanCodeGroup = this.decodeHuffmanCodeGroup(bitReader, huffmanTable);

    // This is a simplified pixel decoding loop. A real implementation would be more complex.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        decodedData[index] = 0; // R
        decodedData[index + 1] = 0; // G
        decodedData[index + 2] = 0; // B
        decodedData[index + 3] = 255; // A
      }
    }

    return {
      width,
      height,
      format: "webp",
      channels: 4,
      bitsPerChannel: 8,
      data: decodedData.buffer,
    };
  }

  private static buildHuffmanTable(codeLengths: number[]): { [key: number]: number } {
    const table: { [key: number]: number } = {};
    let code = 0;
    for (let len = 1; len < 16; len++) {
      for (let i = 0; i < codeLengths.length; i++) {
        if (codeLengths[i] === len) {
          table[code] = i;
          code++;
        }
      }
      code <<= 1;
    }
    return table;
  }

  private static decodeHuffmanCodeGroup(bitReader: BitReader, huffmanTable: { [key: number]: number }): any {
    // This is a placeholder for decoding the Huffman code group.
    // A real implementation would read the code lengths for the five
    // symbol types (green, red, blue, alpha, distance) and build
    // their respective Huffman tables.
    return {};
  }

  private static decodeVp8(chunk: RiffChunk, width: number, height: number): ImageInfo {
    const bitReader = new BitReader(chunk.data);
    const decodedData = new Uint8Array(width * height * 4);

    // TODO: Implement the full VP8 decoding algorithm.
    // 1. Parse frame header.
    // 2. Decode segmentation header.
    // 3. Decode probability updates.
    // 4. Decode macroblock data.
    // 5. Apply dequantization and IDCT.
    // 6. Reconstruct the image.

    return {
      width,
      height,
      format: "webp",
      channels: 4,
      bitsPerChannel: 8,
      data: decodedData.buffer,
    };
  }
}

class BitReader {
  private view: DataView;
  private byteOffset: number = 0;
  private bitPosition: number = 0;

  constructor(view: DataView) {
    this.view = view;
  }

  public readBits(n: number): number {
    let value = 0;
    for (let i = 0; i < n; i++) {
      const byte = this.view.getUint8(this.byteOffset);
      const bit = (byte >> this.bitPosition) & 1;
      value |= bit << i;
      this.bitPosition++;
      if (this.bitPosition === 8) {
        this.bitPosition = 0;
        this.byteOffset++;
      }
    }
    return value;
  }

  public readBit(): number {
    return this.readBits(1);
  }
}
