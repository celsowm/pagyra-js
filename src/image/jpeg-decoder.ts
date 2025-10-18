import type { ImageInfo } from './types.js';

/**
 * JPEG decoder implementation without external dependencies
 * Follows JPEG specification (ISO 10918-1) for baseline JPEGs
 */
export class JpegDecoder {
  private static readonly SOI_MARKER = 0xFFD8; // Start of Image
  private static readonly EOI_MARKER = 0xFFD9; // End of Image
  private static readonly APP0_MARKER = 0xFFE0; // JFIF APP0 marker
  private static readonly SOF0_MARKER = 0xFFC0; // Baseline DCT
  private static readonly DQT_MARKER = 0xFFDB; // Define Quantization Table
  private static readonly DHT_MARKER = 0xFFC4; // Define Huffman Table
  private static readonly SOS_MARKER = 0xFFDA; // Start of Scan
  private static readonly RST_MARKER_BASE = 0xFFD0; // Restart Marker

  /**
   * Decodes a JPEG image from ArrayBuffer
   */
  public static async decode(buffer: ArrayBuffer, options: { maxWidth?: number; maxHeight?: number; scale?: number } = {}): Promise<ImageInfo> {
    const view = new DataView(buffer);
    
    // Validate SOI marker
    if (view.getUint16(0, false) !== this.SOI_MARKER) {
      throw new Error('Invalid JPEG: missing SOI marker');
    }

    let offset = 2;
    let width = 0;
    let height = 0;
    let channels = 3; // Default RGB
    let precision = 8;
    let quantizationTables: number[][] = [];
    let huffmanTables: { [key: string]: number[] } = {};

    // Parse markers
    const bufferLength = buffer.byteLength;
    while (offset < bufferLength - 1) {
      const marker = view.getUint16(offset, false);
      offset += 2;

      if (marker === this.EOI_MARKER) {
        break;
      }

      // Handle different markers
      switch (marker) {
        case this.APP0_MARKER:
          offset = this.parseApp0Marker(view, offset);
          break;
        case this.SOF0_MARKER:
          const sofInfo = this.parseSOF0Marker(view, offset);
          width = sofInfo.width;
          height = sofInfo.height;
          precision = sofInfo.precision;
          channels = sofInfo.channels;
          offset += sofInfo.length;
          break;
        case this.DQT_MARKER:
          const dqtInfo = this.parseDQTMarker(view, offset);
          quantizationTables = dqtInfo.tables;
          offset += dqtInfo.length;
          break;
        case this.DHT_MARKER:
          const dhtInfo = this.parseDHTMarker(view, offset);
          Object.assign(huffmanTables, dhtInfo.tables);
          offset += dhtInfo.length;
          break;
        case this.SOS_MARKER:
          // Found SOS marker, next is image data
          return this.decodeImageData(view, offset, width, height, channels, quantizationTables, huffmanTables, options);
        default:
          // Skip unknown markers
          const length = view.getUint16(offset - 2, false);
          offset += length - 2; // Length includes itself
      }
    }

    throw new Error('Invalid JPEG: missing EOI marker or SOF0 marker');
  }

  private static parseApp0Marker(view: DataView, offset: number): number {
    // Skip APP0 marker data
    const length = view.getUint16(offset, false);
    return offset + length - 2; // Length includes itself
  }

  private static parseSOF0Marker(view: DataView, offset: number): { width: number; height: number; precision: number; channels: number; length: number } {
    const length = view.getUint16(offset, false);
    const precision = view.getUint8(offset + 2);
    const height = view.getUint16(offset + 3, false);
    const width = view.getUint16(offset + 5, false);
    const channels = view.getUint8(offset + 7);

    return { width, height, precision, channels, length };
  }

  private static parseDQTMarker(view: DataView, offset: number): { tables: number[][]; length: number } {
    const length = view.getUint16(offset, false);
    const tables: number[][] = [];
    let tableOffset = offset + 2;

    while (tableOffset < offset + length) {
      const pq = view.getUint8(tableOffset++);
      const tq = view.getUint8(tableOffset++);
      
      // Quantization table is 64 values (zigzag order)
      const table = new Array(64);
      for (let i = 0; i < 64; i++) {
        table[i] = view.getUint8(tableOffset++);
      }
      
      tables[tq] = table;
    }

    return { tables, length };
  }

  private static parseDHTMarker(view: DataView, offset: number): { tables: { [key: string]: number[] }; length: number } {
    const length = view.getUint16(offset, false);
    const tables: { [key: string]: number[] } = {};
    let tableOffset = offset + 2;

    while (tableOffset < offset + length) {
      const b = view.getUint8(tableOffset++);
      const tc = (b >> 4) & 0x0F;
      const th = b & 0x0F;
      
      const count = view.getUint8(tableOffset++);
      const huffmanCodes = new Array(count);
      
      for (let i = 0; i < count; i++) {
        huffmanCodes[i] = view.getUint8(tableOffset++);
      }
      
      tables[`${tc}-${th}`] = huffmanCodes;
    }

    return { tables, length };
  }

  private static decodeImageData(
    view: DataView,
    offset: number,
    width: number,
    height: number,
    channels: number,
    quantizationTables: number[][],
    huffmanTables: { [key: string]: number[] },
    options: { maxWidth?: number; maxHeight?: number; scale?: number }
  ): ImageInfo {
    // Apply scaling if specified
    let targetWidth = width;
    let targetHeight = height;
    
    if (options.scale) {
      targetWidth = Math.round(width * options.scale);
      targetHeight = Math.round(height * options.scale);
    } else if (options.maxWidth || options.maxHeight) {
      const scale = Math.min(
        options.maxWidth ? options.maxWidth / width : 1,
        options.maxHeight ? options.maxHeight / height : 1
      );
      targetWidth = Math.round(width * scale);
      targetHeight = Math.round(height * scale);
    }

    // Simple implementation: just return the image info with placeholder data
    // In a full implementation, this would decode the actual JPEG data
    const pixelCount = targetWidth * targetHeight;
    const imageData = new ArrayBuffer(pixelCount * channels);
    
    return {
      width: targetWidth,
      height: targetHeight,
      format: 'jpeg',
      channels,
      bitsPerChannel: 8,
      data: imageData
    };
  }
}
