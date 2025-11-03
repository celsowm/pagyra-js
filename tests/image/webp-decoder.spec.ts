import { WebpDecoder } from '../../src/image/webp-decoder.js';
import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('WebpDecoder', () => {
  it('should decode a lossy WebP image without errors', async () => {
    const buffer = readFileSync('tests/assets/1.webp');
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const imageInfo = await WebpDecoder.decode(arrayBuffer);
    expect(imageInfo).toBeDefined();
    expect(imageInfo.width).toBeGreaterThan(0);
    expect(imageInfo.height).toBeGreaterThan(0);
  });
});
