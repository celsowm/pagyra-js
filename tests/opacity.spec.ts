import { describe, it, expect } from 'vitest';
import { parseOpacity } from '../src/css/parsers/opacity-parser.js';
import type { StyleAccumulator } from '../src/css/style.js';

describe('Opacity Parser', () => {
  it('should parse decimal opacity values correctly', () => {
    const target: StyleAccumulator = {};
    parseOpacity('0.5', target);
    expect(target.opacity).toBe(0.5);
  });

  it('should parse percentage opacity values correctly', () => {
    const target: StyleAccumulator = {};
    parseOpacity('50%', target);
    expect(target.opacity).toBe(0.5);
  });

  it('should handle opacity value of 1', () => {
    const target: StyleAccumulator = {};
    parseOpacity('1', target);
    expect(target.opacity).toBe(1);
  });

  it('should handle opacity value of 0', () => {
    const target: StyleAccumulator = {};
    parseOpacity('0', target);
    expect(target.opacity).toBe(0);
  });

  it('should clamp values above 1 to 1', () => {
    const target: StyleAccumulator = {};
    parseOpacity('1.5', target);
    expect(target.opacity).toBe(1);
  });

  it('should clamp values below 0 to 0', () => {
    const target: StyleAccumulator = {};
    parseOpacity('-0.5', target);
    expect(target.opacity).toBe(0);
  });

  it('should handle percentage values above 100%', () => {
    const target: StyleAccumulator = {};
    parseOpacity('150%', target);
    expect(target.opacity).toBe(1);
  });

  it('should handle percentage values below 0%', () => {
    const target: StyleAccumulator = {};
    parseOpacity('-25%', target);
    expect(target.opacity).toBe(0);
  });

  it('should ignore invalid values', () => {
    const target: StyleAccumulator = {};
    parseOpacity('invalid', target);
    expect(target.opacity).toBeUndefined();
  });

  it('should handle decimal values with more precision', () => {
    const target: StyleAccumulator = {};
    parseOpacity('0.75', target);
    expect(target.opacity).toBe(0.75);
  });

  it('should handle percentage values with decimal points', () => {
    const target: StyleAccumulator = {};
    parseOpacity('75.5%', target);
    expect(target.opacity).toBe(0.755);
  });
});
