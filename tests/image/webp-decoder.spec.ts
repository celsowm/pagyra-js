import { WebpDecoder } from '../../src/image/webp-decoder.js';
import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('WebpDecoder', () => {
  it('should decode a WebP image and return valid image info', async () => {
    const buffer = readFileSync('tests/assets/1.webp');
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const decoder = new WebpDecoder();
    const imageInfo = await decoder.decode(arrayBuffer);
    expect(imageInfo).toBeDefined();
    expect(imageInfo.width).toBeGreaterThan(0);
    expect(imageInfo.height).toBeGreaterThan(0);
    expect(imageInfo.format).toBe('webp');
    expect(imageInfo.channels).toBe(4);
    expect(imageInfo.bitsPerChannel).toBe(8);
    expect(imageInfo.data).toBeInstanceOf(ArrayBuffer);
  });
});
