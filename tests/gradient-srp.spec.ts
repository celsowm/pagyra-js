import { describe, it, expect, beforeAll } from 'vitest';
import { parseLinearGradient } from '../src/css/parsers/gradient-parser.js';
import { GradientService } from '../src/pdf/shading/gradient-service.js';
import { CoordinateTransformer } from '../src/pdf/utils/coordinate-transformer.js';

describe('Gradient SRP Implementation', () => {
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const M = 36.0;
  const RECT_W = 200.0;
  const RECT_H = 100.0;
  const x = M;
  const y = PAGE_H - M - RECT_H;

  let gradientService: GradientService;
  let coordinateTransformer: CoordinateTransformer;

  beforeAll(() => {
    coordinateTransformer = new CoordinateTransformer(
      PAGE_H,
      (px: number) => px * 0.75, // Simple px to pt conversion
      0
    );
    gradientService = new GradientService(coordinateTransformer);
  });

  it('creates gradient service with proper SRP', () => {
    expect(gradientService).toBeInstanceOf(GradientService);
    expect(gradientService).toHaveProperty('createLinearGradient');
    expect(gradientService).toHaveProperty('getPatternCommands');
    expect(gradientService).toHaveProperty('getGraphicsStates');
    expect(gradientService).toHaveProperty('clearPatterns');
  });

  it('parses gradient string correctly', () => {
    const gradientStr = 'linear-gradient(to right, red, yellow)';
    const gradient = parseLinearGradient(gradientStr);
    
    expect(gradient).not.toBeNull();
    expect(gradient?.type).toBe('linear');
    expect(gradient?.direction).toBe('to right');
    expect(gradient?.stops).toHaveLength(2);
    expect(gradient?.stops[0].color).toBe('red');
    expect(gradient?.stops[1].color).toBe('yellow');
  });

  it('creates linear gradient pattern for rectangle', () => {
    const gradientStr = 'linear-gradient(to right, red, yellow)';
    const gradient = parseLinearGradient(gradientStr);
    
    if (!gradient) {
      throw new Error('Gradient parsing failed');
    }

    const rect = { x, y, width: RECT_W, height: RECT_H };
    const pattern = gradientService.createLinearGradient(gradient, rect);

    expect(pattern).toBeDefined();
    expect(pattern.patternName).toMatch(/^Grad\d+$/);
    expect(pattern.commands).toBeInstanceOf(Array);
    expect(pattern.commands.length).toBeGreaterThan(0);

    // Check for required PDF pattern components
    const commandsStr = pattern.commands.join('\n');
    expect(commandsStr).toContain('/PatternType 2');
    expect(commandsStr).toContain('/ShadingType 2');
    expect(commandsStr).toContain('/ColorSpace /DeviceRGB');
    expect(commandsStr).toContain('/Coords');
    expect(commandsStr).toContain('/BBox');
    expect(commandsStr).toContain('/C0');
    expect(commandsStr).toContain('/C1');
    expect(commandsStr).toContain('/N 1');
  });

  it('calculates correct coordinates for horizontal gradient', () => {
    const gradientStr = 'linear-gradient(to right, red, yellow)';
    const gradient = parseLinearGradient(gradientStr);
    
    if (!gradient) {
      throw new Error('Gradient parsing failed');
    }

    const rect = { x, y, width: RECT_W, height: RECT_H };
    gradientService.clearPatterns(); // Clear any previous patterns
    const pattern = gradientService.createLinearGradient(gradient, rect);
    
    const commandsStr = pattern.commands.join('\n');
    
    // Extract coordinates from the pattern commands
    const coordsMatch = commandsStr.match(/\/Coords\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]/);
    expect(coordsMatch).toBeTruthy();
    
    if (coordsMatch) {
      const [_, x0, y0, x1, y1] = coordsMatch;
      const expectedX0 = coordinateTransformer.convertPxToPt(x);
      const expectedY0 = coordinateTransformer.convertPxToPt(y + RECT_H / 2);
      const expectedX1 = coordinateTransformer.convertPxToPt(x + RECT_W);
      const expectedY1 = coordinateTransformer.convertPxToPt(y + RECT_H / 2);
      
      // Check coordinates are within reasonable tolerance
      expect(Math.abs(parseFloat(x0) - expectedX0)).toBeLessThan(0.1);
      expect(Math.abs(parseFloat(y0) - expectedY0)).toBeLessThan(0.1);
      expect(Math.abs(parseFloat(x1) - expectedX1)).toBeLessThan(0.1);
      expect(Math.abs(parseFloat(y1) - expectedY1)).toBeLessThan(0.1);
    }
  });

  it('generates correct color values for red to yellow gradient', () => {
    const gradientStr = 'linear-gradient(to right, red, yellow)';
    const gradient = parseLinearGradient(gradientStr);
    
    if (!gradient) {
      throw new Error('Gradient parsing failed');
    }

    const rect = { x, y, width: RECT_W, height: RECT_H };
    gradientService.clearPatterns();
    const pattern = gradientService.createLinearGradient(gradient, rect);
    
    const commandsStr = pattern.commands.join('\n');
    
    // Check for red color (C0 should be [1 0 0])
    const redMatch = commandsStr.match(/\/C0\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]/);
    expect(redMatch).toBeTruthy();
    if (redMatch) {
      expect(parseFloat(redMatch[1])).toBeCloseTo(1, 2); // R
      expect(parseFloat(redMatch[2])).toBeCloseTo(0, 2); // G
      expect(parseFloat(redMatch[3])).toBeCloseTo(0, 2); // B
    }
    
    // Check for yellow color (C1 should be [1 1 0])
    const yellowMatch = commandsStr.match(/\/C1\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]/);
    expect(yellowMatch).toBeTruthy();
    if (yellowMatch) {
      expect(parseFloat(yellowMatch[1])).toBeCloseTo(1, 2); // R
      expect(parseFloat(yellowMatch[2])).toBeCloseTo(1, 2); // G
      expect(parseFloat(yellowMatch[3])).toBeCloseTo(0, 2); // B
    }
  });

  it('generates unique pattern names for multiple gradients', () => {
    const gradientStr = 'linear-gradient(to right, red, yellow)';
    const gradient = parseLinearGradient(gradientStr);
    
    if (!gradient) {
      throw new Error('Gradient parsing failed');
    }

    gradientService.clearPatterns();
    const rect = { x, y, width: RECT_W, height: RECT_H };
    
    const pattern1 = gradientService.createLinearGradient(gradient, rect);
    const pattern2 = gradientService.createLinearGradient(gradient, { x: x + 50, y: y + 50, width: RECT_W, height: RECT_H });
    
    expect(pattern1.patternName).not.toBe(pattern2.patternName);
    expect(pattern1.patternName).toMatch(/^Grad\d+$/);
    expect(pattern2.patternName).toMatch(/^Grad\d+$/);
  });

  it('handles different gradient directions', () => {
    const directions = ['to bottom', 'to top', 'to left', '45deg'];
    
    for (const direction of directions) {
      const gradientStr = `linear-gradient(${direction}, red, blue)`;
      const gradient = parseLinearGradient(gradientStr);
      
      if (!gradient) {
        throw new Error(`Gradient parsing failed for direction: ${direction}`);
      }

      const rect = { x, y, width: RECT_W, height: RECT_H };
      gradientService.clearPatterns();
      const pattern = gradientService.createLinearGradient(gradient, rect);
      
      expect(pattern).toBeDefined();
      expect(pattern.patternName).toMatch(/^Grad\d+$/);
      
      const commandsStr = pattern.commands.join('\n');
      expect(commandsStr).toContain('/PatternType 2');
      expect(commandsStr).toContain('/ShadingType 2');
    }
  });

  it('returns empty pattern commands when no gradients created', () => {
    gradientService.clearPatterns();
    const commands = gradientService.getPatternCommands();
    expect(commands).toEqual([]);
  });

  it('returns empty graphics states when no gradients created', () => {
    gradientService.clearPatterns();
    const states = gradientService.getGraphicsStates();
    expect(states.size).toBe(0);
  });

  it('clears patterns correctly', () => {
    const gradientStr = 'linear-gradient(to right, red, yellow)';
    const gradient = parseLinearGradient(gradientStr);
    
    if (!gradient) {
      throw new Error('Gradient parsing failed');
    }

    const rect = { x, y, width: RECT_W, height: RECT_H };
    gradientService.clearPatterns();
    
    // Create a pattern
    const pattern1 = gradientService.createLinearGradient(gradient, rect);
    expect(pattern1.patternName).toBe('Grad0');
    
    // Clear patterns
    gradientService.clearPatterns();
    
    // Create another pattern - should start from 0 again
    const pattern2 = gradientService.createLinearGradient(gradient, rect);
    expect(pattern2.patternName).toBe('Grad0');
  });
});
