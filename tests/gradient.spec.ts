import { describe, it, expect } from 'vitest';
import { parseLinearGradient } from '../src/css/parsers/gradient-parser.js';

describe('Linear Gradient Parser', () => {
  it('should parse simple horizontal gradient', () => {
    const result = parseLinearGradient('linear-gradient(to right, #ff0000, #0000ff)');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('linear');
    expect(result?.direction).toBe('to right');
    expect(result?.stops).toHaveLength(2);
    expect(result?.stops[0].color).toBe('#ff0000');
    expect(result?.stops[1].color).toBe('#0000ff');
  });

  it('should parse vertical gradient', () => {
    const result = parseLinearGradient('linear-gradient(to bottom, red, green)');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('linear');
    expect(result?.direction).toBe('to bottom');
    expect(result?.stops).toHaveLength(2);
    expect(result?.stops[0].color).toBe('red');
    expect(result?.stops[1].color).toBe('green');
  });

  it('should parse diagonal gradient', () => {
    const result = parseLinearGradient('linear-gradient(45deg, #ff0000, #00ff00, #0000ff)');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('linear');
    expect(result?.direction).toBe('45deg');
    expect(result?.stops).toHaveLength(3);
    expect(result?.stops[0].color).toBe('#ff0000');
    expect(result?.stops[1].color).toBe('#00ff00');
    expect(result?.stops[2].color).toBe('#0000ff');
  });

  it('should parse gradient with color stops', () => {
    const result = parseLinearGradient('linear-gradient(to right, #ff0000, #ffff00 50%, #0000ff)');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('linear');
    expect(result?.direction).toBe('to right');
    expect(result?.stops).toHaveLength(3);
    expect(result?.stops[0].color).toBe('#ff0000');
    expect(result?.stops[0].position).toBeUndefined();
    expect(result?.stops[1].color).toBe('#ffff00');
    expect(result?.stops[1].position).toBe(0.5);
    expect(result?.stops[2].color).toBe('#0000ff');
    expect(result?.stops[2].position).toBeUndefined();
  });

  it('should parse gradient with percentage stops', () => {
    const result = parseLinearGradient('linear-gradient(to right, #ff0000 0%, #00ff00 50%, #0000ff 100%)');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('linear');
    expect(result?.direction).toBe('to right');
    expect(result?.stops).toHaveLength(3);
    expect(result?.stops[0].color).toBe('#ff0000');
    expect(result?.stops[0].position).toBe(0);
    expect(result?.stops[1].color).toBe('#00ff00');
    expect(result?.stops[1].position).toBe(0.5);
    expect(result?.stops[2].color).toBe('#0000ff');
    expect(result?.stops[2].position).toBe(1);
  });

  it('should return null for invalid gradient', () => {
    const result = parseLinearGradient('invalid-gradient(to right, red, blue)');
    expect(result).toBeNull();
  });

  it('should return null for empty gradient', () => {
    const result = parseLinearGradient('linear-gradient()');
    expect(result).toBeNull();
  });

  it('should handle gradient with no color stops', () => {
    const result = parseLinearGradient('linear-gradient(to right)');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('linear');
    expect(result?.direction).toBe('to right');
    expect(result?.stops).toHaveLength(1);
    expect(result?.stops[0].color).toBe('#000000');
  });

  it('should handle gradient with spaces', () => {
    const result = parseLinearGradient('  linear-gradient(  to right  ,  red  ,  blue  )  ');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('linear');
    expect(result?.direction).toBe('to right');
    expect(result?.stops).toHaveLength(2);
    expect(result?.stops[0].color).toBe('red');
    expect(result?.stops[1].color).toBe('blue');
  });
});
