import { JpegDecoder } from './jpeg-decoder.js';
import { PngDecoder } from './png-decoder.js';
import type { ImageInfo, ImageDecodeOptions } from './types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

/**
 * Image Service following SOLID principles:
 * - Single Responsibility: Handles all image operations
 * - Open/Closed: Extensible for new image formats
 * - Dependency Inversion: Depends on abstractions, not concrete implementations
 */
export class ImageService {
  private static instance: ImageService;
  private imageCache = new Map<string, ImageInfo>();

  /**
   * Singleton pattern implementation
   */
  public static getInstance(): ImageService {
    if (!ImageService.instance) {
      ImageService.instance = new ImageService();
    }
    return ImageService.instance;
  }

  /**
   * Loads an image from file path
   */
  public async loadImage(path: string, options?: ImageDecodeOptions): Promise<ImageInfo> {
    const normalizedPath = this.normalizeSource(path);
    // Check cache first
    const cacheKey = this.generateCacheKey(normalizedPath, options);
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey)!;
    }

    try {
      const buffer = readFileSync(normalizedPath);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const imageInfo = await this.decodeImage(arrayBuffer, options);

      // Cache the result
      this.imageCache.set(cacheKey, imageInfo);
      return imageInfo;
    } catch (error) {
      throw new Error(`Failed to load image from ${normalizedPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Decodes image data from buffer
   */
  public async decodeImage(buffer: ArrayBuffer, options?: ImageDecodeOptions): Promise<ImageInfo> {
    // Detect image format by checking file signatures
    const format = this.detectImageFormat(buffer);
    
    switch (format) {
      case 'jpeg':
        return JpegDecoder.decode(buffer, options);
      case 'png':
        return PngDecoder.decode(buffer, options);
      case 'gif':
        // Placeholder for GIF decoder
        return this.decodeGif(buffer, options);
      case 'webp':
        // Placeholder for WebP decoder
        return this.decodeWebp(buffer, options);
      default:
        throw new Error(`Unsupported image format: ${format}`);
    }
  }

  /**
   * Detects image format by magic numbers
   */
  private detectImageFormat(buffer: ArrayBuffer): 'jpeg' | 'png' | 'gif' | 'webp' {
    const view = new DataView(buffer);
    
    // JPEG signature: FF D8 FF
    if (buffer.byteLength >= 3 && 
        view.getUint8(0) === 0xFF && 
        view.getUint8(1) === 0xD8 && 
        view.getUint8(2) === 0xFF) {
      return 'jpeg';
    }
    
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer.byteLength >= 8 && 
        view.getUint8(0) === 0x89 && 
        view.getUint8(1) === 0x50 && 
        view.getUint8(2) === 0x4E && 
        view.getUint8(3) === 0x47 && 
        view.getUint8(4) === 0x0D && 
        view.getUint8(5) === 0x0A && 
        view.getUint8(6) === 0x1A && 
        view.getUint8(7) === 0x0A) {
      return 'png';
    }
    
    // GIF signature: GIF87a or GIF89a
    if (buffer.byteLength >= 6) {
      const gifSignature = new TextDecoder().decode(buffer.slice(0, 6));
      if (gifSignature.startsWith('GIF')) {
        return 'gif';
      }
    }
    
    // WebP signature: RIFF + WEBP
    if (buffer.byteLength >= 12 && 
        view.getUint32(0, false) === 0x52494646 && // "RIFF"
        view.getUint32(8, false) === 0x57454250) { // "WEBP"
      return 'webp';
    }
    
    throw new Error('Unknown image format');
  }


  /**
   * Placeholder GIF decoder
   */
  private decodeGif(buffer: ArrayBuffer, options?: ImageDecodeOptions): ImageInfo {
    // For now, return placeholder data
    const width = options?.maxWidth || 100;
    const height = options?.maxHeight || 100;
    const pixelCount = width * height;
    const imageData = new ArrayBuffer(pixelCount * 4); // RGBA
    
    return {
      width,
      height,
      format: 'gif',
      channels: 4,
      bitsPerChannel: 8,
      data: imageData
    };
  }

  /**
   * Placeholder WebP decoder
   */
  private decodeWebp(buffer: ArrayBuffer, options?: ImageDecodeOptions): ImageInfo {
    // For now, return placeholder data
    const width = options?.maxWidth || 100;
    const height = options?.maxHeight || 100;
    const pixelCount = width * height;
    const imageData = new ArrayBuffer(pixelCount * 4); // RGBA
    
    return {
      width,
      height,
      format: 'webp',
      channels: 4,
      bitsPerChannel: 8,
      data: imageData
    };
  }

  /**
   * Generates a cache key for image options
   */
  private generateCacheKey(path: string, options?: ImageDecodeOptions): string {
    const optionsStr = options ? 
      `_${options.maxWidth || 0}_${options.maxHeight || 0}_${options.scale || 1}` : 
      '_default';
    return `${path}${optionsStr}`;
  }

  /**
   * Clears the image cache
   */
  public clearCache(): void {
    this.imageCache.clear();
  }

  private normalizeSource(source: string): string {
    if (source.startsWith("file://")) {
      return fileURLToPath(source);
    }
    return source;
  }
}
