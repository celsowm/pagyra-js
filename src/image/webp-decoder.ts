import type { ImageInfo } from "./types.js";

interface RiffChunk {
  fourCC: string;
  size: number;
  data: DataView;
}

export class WebpDecoder {
  public static async decode(buffer: ArrayBuffer): Promise<ImageInfo> {
    const view = new DataView(buffer);

    // Check RIFF and WEBP signatures
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
      offset += 8 + size + (size % 2);
    }

    const vp8lChunk = chunks.find(c => c.fourCC === 'VP8L');
    if (!vp8lChunk) {
      throw new Error("Only VP8L (lossless) WebP supported");
    }

    return this.decodeVp8l(vp8lChunk);
  }

  private static decodeVp8l(chunk: RiffChunk): ImageInfo {
    const br = new BitReader(chunk.data);

    // VP8L signature
    if (br.readBits(8) !== 0x2f) {
      throw new Error("Invalid VP8L signature");
    }

    const width = br.readBits(14) + 1;
    const height = br.readBits(14) + 1;
    const hasAlpha = br.readBits(1);
    const versionNumber = br.readBits(3);

    // Check for transforms - only support images without transforms
    const transforms = [];
    while (br.readBits(1)) {
      const transformType = br.readBits(2);
      transforms.push(transformType);
      // Skip transform data (simplified - won't work for all images)
      if (transformType === 1) { // COLOR_TRANSFORM
        const sizeBits = br.readBits(3) + 2;
        const blockWidth = this.subSampleSize(width, sizeBits);
        const blockHeight = this.subSampleSize(height, sizeBits);
        this.readTransformImage(br, blockWidth, blockHeight);
      } else if (transformType === 0) { // PREDICTOR_TRANSFORM
        const sizeBits = br.readBits(3) + 2;
        const blockWidth = this.subSampleSize(width, sizeBits);
        const blockHeight = this.subSampleSize(height, sizeBits);
        this.readTransformImage(br, blockWidth, blockHeight);
      } else if (transformType === 3) { // COLOR_INDEXING_TRANSFORM
        const numColors = br.readBits(8) + 1;
        if (numColors <= 16) {
          this.readTransformImage(br, numColors, 1);
        }
      }
    }

    // Read Huffman codes
    const huffmanCodes = this.readHuffmanCodes(br);

    // Decode pixels
    const pixels = new Uint8Array(width * height * 4);
    let pixelIndex = 0;

    for (let i = 0; i < width * height; i++) {
      const green = this.readSymbol(br, huffmanCodes[0]);
      
      if (green < 256) {
        // Literal pixel
        const red = this.readSymbol(br, huffmanCodes[1]);
        const blue = this.readSymbol(br, huffmanCodes[2]);
        const alpha = this.readSymbol(br, huffmanCodes[3]);
        
        pixels[pixelIndex++] = red;
        pixels[pixelIndex++] = green;
        pixels[pixelIndex++] = blue;
        pixels[pixelIndex++] = alpha;
      } else {
        // Backward reference (LZ77)
        const lengthSymbol = green - 256;
        const length = this.getLengthFromSymbol(lengthSymbol, br);
        const distSymbol = this.readSymbol(br, huffmanCodes[4]);
        const distance = this.getDistanceFromSymbol(distSymbol, br);
        
        // Copy pixels
        for (let j = 0; j < length; j++) {
          const srcIdx = pixelIndex - distance * 4;
          pixels[pixelIndex++] = pixels[srcIdx];
          pixels[pixelIndex++] = pixels[srcIdx + 1];
          pixels[pixelIndex++] = pixels[srcIdx + 2];
          pixels[pixelIndex++] = pixels[srcIdx + 3];
        }
      }
    }

    return {
      width,
      height,
      format: "webp",
      channels: 4,
      bitsPerChannel: 8,
      data: pixels.buffer,
    };
  }

  private static subSampleSize(size: number, samplingBits: number): number {
    return (size + (1 << samplingBits) - 1) >> samplingBits;
  }

  private static readTransformImage(br: BitReader, width: number, height: number): void {
    const huffmanCodes = this.readHuffmanCodes(br);
    // Skip transform image pixels
    for (let i = 0; i < width * height; i++) {
      const green = this.readSymbol(br, huffmanCodes[0]);
      if (green < 256) {
        this.readSymbol(br, huffmanCodes[1]); // red
        this.readSymbol(br, huffmanCodes[2]); // blue
        this.readSymbol(br, huffmanCodes[3]); // alpha
      } else {
        const lengthSymbol = green - 256;
        const length = this.getLengthFromSymbol(lengthSymbol, br);
        const distSymbol = this.readSymbol(br, huffmanCodes[4]);
        this.getDistanceFromSymbol(distSymbol, br);
        i += length - 1;
      }
    }
  }

  private static readHuffmanCodes(br: BitReader): HuffmanTree[] {
    const numCodeGroups = 1; // Simplified - always use 1 group
    const huffmanCodes: HuffmanTree[] = [];

    for (let g = 0; g < numCodeGroups; g++) {
      for (let i = 0; i < 5; i++) {
        huffmanCodes[i] = this.readHuffmanCode(br, i === 4 ? 40 : 256 + 24);
      }
    }

    return huffmanCodes;
  }

  private static readHuffmanCode(br: BitReader, alphabetSize: number): HuffmanTree {
    const simple = br.readBits(1);
    
    if (simple) {
      const numSymbols = br.readBits(1) + 1;
      const symbols: number[] = [];
      
      if (br.readBits(1)) { // is_first_8bits
        symbols.push(br.readBits(8));
        if (numSymbols === 2) {
          symbols.push(br.readBits(8));
        }
      } else {
        symbols.push(br.readBits(1));
        if (numSymbols === 2) {
          symbols.push(br.readBits(1));
        }
      }
      
      return this.buildSimpleHuffman(symbols);
    }

    // Read code length codes
    const codeLengthCodeLengths = new Array(19).fill(0);
    const numCodeLengthCodes = 4 + br.readBits(4);
    const kCodeLengthCodeOrder = [17, 18, 0, 1, 2, 3, 4, 5, 16, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    
    for (let i = 0; i < numCodeLengthCodes; i++) {
      codeLengthCodeLengths[kCodeLengthCodeOrder[i]] = br.readBits(3);
    }

    const codeLengthTree = this.buildHuffmanTree(codeLengthCodeLengths);
    const codeLengths = new Array(alphabetSize).fill(0);
    let i = 0;

    while (i < alphabetSize) {
      const code = this.readSymbol(br, codeLengthTree);
      
      if (code < 16) {
        codeLengths[i++] = code;
      } else {
        let repeatCount = 0;
        let repeatValue = 0;
        
        if (code === 16) {
          repeatCount = 3 + br.readBits(2);
          repeatValue = codeLengths[i - 1];
        } else if (code === 17) {
          repeatCount = 3 + br.readBits(3);
        } else {
          repeatCount = 11 + br.readBits(7);
        }
        
        while (repeatCount-- > 0 && i < alphabetSize) {
          codeLengths[i++] = repeatValue;
        }
      }
    }

    return this.buildHuffmanTree(codeLengths);
  }

  private static buildSimpleHuffman(symbols: number[]): HuffmanTree {
    if (symbols.length === 1) {
      return { codes: [{ symbol: symbols[0], length: 0 }], maxLength: 0 };
    }
    return {
      codes: [
        { symbol: symbols[0], length: 1 },
        { symbol: symbols[1], length: 1 }
      ],
      maxLength: 1
    };
  }

  private static buildHuffmanTree(codeLengths: number[]): HuffmanTree {
    const maxLength = Math.max(...codeLengths);
    const codes: Array<{ symbol: number; length: number; code: number }> = [];
    
    let code = 0;
    const bl_count = new Array(maxLength + 1).fill(0);
    const next_code = new Array(maxLength + 1).fill(0);
    
    for (const len of codeLengths) {
      bl_count[len]++;
    }
    
    for (let bits = 1; bits <= maxLength; bits++) {
      code = (code + bl_count[bits - 1]) << 1;
      next_code[bits] = code;
    }
    
    for (let n = 0; n < codeLengths.length; n++) {
      const len = codeLengths[n];
      if (len !== 0) {
        codes.push({ symbol: n, length: len, code: next_code[len] });
        next_code[len]++;
      }
    }
    
    return { codes, maxLength };
  }

  private static readSymbol(br: BitReader, tree: HuffmanTree): number {
    if (tree.maxLength === 0) {
      return tree.codes[0].symbol;
    }
    
    let code = 0;
    for (let i = 0; i < tree.maxLength; i++) {
      code = (code << 1) | br.readBits(1);
      const found = tree.codes.find(c => c.length === i + 1 && c.code === code);
      if (found) {
        return found.symbol;
      }
    }
    
    return 0;
  }

  private static getLengthFromSymbol(symbol: number, br: BitReader): number {
    if (symbol < 4) return symbol + 1;
    const extraBits = (symbol - 2) >> 1;
    const offset = (2 + (symbol & 1)) << extraBits;
    return offset + br.readBits(extraBits) + 1;
  }

  private static getDistanceFromSymbol(symbol: number, br: BitReader): number {
    if (symbol < 4) return symbol + 1;
    const extraBits = (symbol - 2) >> 1;
    const offset = (2 + (symbol & 1)) << extraBits;
    return offset + br.readBits(extraBits) + 1;
  }
}

interface HuffmanTree {
  codes: Array<{ symbol: number; length: number; code?: number }>;
  maxLength: number;
}

class BitReader {
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
      const bit = (byte >> this.bitPos) & 1; // LSB-first!
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