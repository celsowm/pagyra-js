import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PagePainter } from '../src/pdf/page-painter.js';
import type { FontRegistry } from '../src/pdf/font/font-registry.js';
import type { RGBA, Run, ImageRef, Rect, Radius } from '../src/pdf/types.js';


// Mock FontRegistry
const createMockFontRegistry = (): FontRegistry => {
  return {
    ensureFontResource: vi.fn().mockResolvedValue({
      baseFont: 'Helvetica',
      resourceName: 'F1',
      ref: { objectNumber: 1 },
      isBase14: true
    }),
    ensureFontResourceSync: vi.fn().mockReturnValue({
      baseFont: 'Helvetica',
      resourceName: 'F1',
      ref: { objectNumber: 1 },
      isBase14: true
    }),
    initializeEmbedder: vi.fn().mockResolvedValue(undefined),
    setFontConfig: vi.fn(),
    getEmbedder: vi.fn().mockReturnValue(null),
    getDefaultFontStack: vi.fn().mockReturnValue([]),
  } as unknown as FontRegistry;
};

describe('PagePainter', () => {
  let fontRegistry: FontRegistry;
  let pagePainter: PagePainter;
  const pxToPt = (px: number) => px * 0.75; // 96 DPI assumption
  const pageHeightPt = 841.89; // A4 height in points

  beforeEach(() => {
    fontRegistry = createMockFontRegistry();
    pagePainter = new PagePainter(pageHeightPt, pxToPt, fontRegistry);
  });

  it('should initialize correctly', () => {
    expect(pagePainter).toBeInstanceOf(PagePainter);
    expect(pagePainter.pageHeightPx).toBeGreaterThan(0);
  });

  it('should draw text and add to commands', async () => {
    const text = 'Hello, World!';
    const xPx = 10;
    const yPx = 20;
    const options = { fontSizePt: 12, color: { r: 0, g: 0, b: 0, a: 1 } };

    await pagePainter.drawText(text, xPx, yPx, options);
    const result = pagePainter.result();

    expect(result.content).toContain('Hello, World!');
    expect(result.content).toContain('BT'); // Begin text
    expect(result.content).toContain('ET'); // End text
    expect(result.fonts.size).toBeGreaterThan(0);
  });

  it('should draw text run and add to commands', async () => {
    const run: Run = {
      text: 'Test run',
      fontFamily: 'Helvetica',
      fontSize: 16,
      fontWeight: 400,
      fill: { r: 0, g: 0, b: 0, a: 1 },
      lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
      wordSpacing: 1,
      decorations: { lineThrough: true },
      advanceWidth: 50
    };

    await pagePainter.drawTextRun(run);
    const result = pagePainter.result();

    expect(result.content).toContain('Test run');
    expect(result.content).toContain('BT');
    expect(result.content).toContain('ET');
    expect(result.fonts.size).toBeGreaterThan(0);
  });

  it('should draw filled box', () => {
    const box: Rect = { x: 0, y: 0, width: 100, height: 50 };
    const color: RGBA = { r: 1, g: 0, b: 0, a: 1 };

    pagePainter.drawFilledBox(box, color);

    const result = pagePainter.result();
    expect(result.content).toContain('f'); // Fill command
 });

  it('should draw image', () => {
    const image: ImageRef = {
      src: 'test.jpg',
      width: 100,
      height: 50,
      format: 'jpeg',
      channels: 3,
      bitsPerComponent: 8,
      data: new ArrayBuffer(1000)
    };
    const rect: Rect = { x: 10, y: 10, width: 100, height: 50 };

    pagePainter.drawImage(image, rect);
    const result = pagePainter.result();

    expect(result.content).toContain('q'); // Save graphics state
    expect(result.content).toContain('Q'); // Restore graphics state
    expect(result.content).toContain('Do'); // Image drawing command
  });

 it('should draw rounded rectangle', () => {
    const rect: Rect = { x: 10, y: 10, width: 100, height: 50 };
    const radii: Radius = {
      topLeft: { x: 5, y: 5 },
      topRight: { x: 5, y: 5 },
      bottomRight: { x: 5, y: 5 },
      bottomLeft: { x: 5, y: 5 }
    };
    const color: RGBA = { r: 0, g: 1, b: 0, a: 1 };

    pagePainter.fillRoundedRect(rect, radii, color);
    const result = pagePainter.result();

    expect(result.content).toContain('f'); // Fill command
    // Should contain cubic Bézier curves for rounded corners
    expect(result.content).toContain('c');
  });

  it('should return correct result format', () => {
    const result = pagePainter.result();

    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('fonts');
    expect(result).toHaveProperty('images');
    expect(result).toHaveProperty('graphicsStates');
    
    expect(typeof result.content).toBe('string');
    expect(result.fonts).toBeInstanceOf(Map);
    expect(result.images).toBeInstanceOf(Array);
    expect(result.graphicsStates).toBeInstanceOf(Map);
  });
});
