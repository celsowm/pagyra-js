import { describe, it, expect } from 'vitest';
import { parseElement, parseSvg } from '../../src/svg/parser.js';
import type { SvgImageNode, SvgUseNode, SvgClipPathNode, SvgLinearGradientNode, SvgRadialGradientNode } from '../../src/svg/types.js';
import { parseHTML } from 'linkedom';

// Helper function to create DOM elements for testing
function createElement(tagName: string, attributes: Record<string, string> = {}): Element {
  const { document } = parseHTML('<svg></svg>');
  const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

describe('SVG Parser - New Node Types', () => {
  const mockWarn = () => {};

  describe('parseImage', () => {
    it('should parse basic image element', () => {
      const element = createElement('image', {
        x: '10',
        y: '20',
        width: '100',
        height: '50',
        href: 'test.png'
      });

      const result = parseElement(element, { warn: mockWarn }) as SvgImageNode;

      expect(result).not.toBeNull();
      expect(result.type).toBe('image');
      expect(result.x).toBe(10);
      expect(result.y).toBe(20);
      expect(result.width).toBe(100);
      expect(result.height).toBe(50);
      expect(result.href).toBe('test.png');
    });

    it('should parse image with xlink:href', () => {
      const element = createElement('image', {
        'xlink:href': 'test.svg'
      });

      const result = parseElement(element, { warn: mockWarn }) as SvgImageNode;

      expect(result.href).toBe('test.svg');
    });

    it('should parse image with preserveAspectRatio', () => {
      const element = createElement('image', {
        preserveAspectRatio: 'xMidYMid meet'
      });

      const result = parseElement(element, { warn: mockWarn }) as SvgImageNode;

      expect(result.preserveAspectRatio).toBe('xMidYMid meet');
    });

    it('should handle optional attributes', () => {
      const element = createElement('image', {
        href: 'test.png'
      });

      const result = parseElement(element, { warn: mockWarn }) as SvgImageNode;

      expect(result.x).toBeUndefined();
      expect(result.y).toBeUndefined();
      expect(result.width).toBeUndefined();
      expect(result.height).toBeUndefined();
    });
  });

  describe('parseUse', () => {
    it('should parse basic use element', () => {
      const element = createElement('use', {
        x: '5',
        y: '10',
        width: '50',
        height: '30',
        href: '#symbol1'
      });

      const result = parseElement(element, { warn: mockWarn }) as SvgUseNode;

      expect(result).not.toBeNull();
      expect(result.type).toBe('use');
      expect(result.x).toBe(5);
      expect(result.y).toBe(10);
      expect(result.width).toBe(50);
      expect(result.height).toBe(30);
      expect(result.href).toBe('#symbol1');
    });

    it('should parse use with xlink:href', () => {
      const element = createElement('use', {
        'xlink:href': '#symbol2'
      });

      const result = parseElement(element, { warn: mockWarn }) as SvgUseNode;

      expect(result.href).toBe('#symbol2');
    });

    it('should handle optional width and height', () => {
      const element = createElement('use', {
        href: '#symbol1'
      });

      const result = parseElement(element, { warn: mockWarn }) as SvgUseNode;

      expect(result.width).toBeUndefined();
      expect(result.height).toBeUndefined();
    });
  });

  describe('parseClipPath', () => {
    it('should parse basic clipPath element', () => {
      const element = createElement('clipPath', {
        id: 'clip1'
      });
      const rect = createElement('rect', { width: '100', height: '100' });
      element.appendChild(rect);

      const result = parseElement(element, { warn: mockWarn }) as SvgClipPathNode;

      expect(result).not.toBeNull();
      expect(result.type).toBe('clippath');
      expect(result.clipPathUnits).toBe('userSpaceOnUse'); // default
      expect(result.children).toHaveLength(1);
    });

    it('should parse clipPath with objectBoundingBox units', () => {
      const element = createElement('clipPath', {
        clipPathUnits: 'objectBoundingBox'
      });

      const result = parseElement(element, { warn: mockWarn }) as SvgClipPathNode;

      expect(result.clipPathUnits).toBe('objectBoundingBox');
    });

    it('should default to userSpaceOnUse for invalid units', () => {
      const element = createElement('clipPath', {
        clipPathUnits: 'invalid'
      });

      const result = parseElement(element, { warn: mockWarn }) as SvgClipPathNode;

      expect(result.clipPathUnits).toBe('userSpaceOnUse');
    });
  });

  describe('parseLinearGradient', () => {
    it('should parse basic linearGradient', () => {
      const element = createElement('linearGradient', {
        x1: '0',
        y1: '0',
        x2: '1',
        y2: '0'
      });
      const stop1 = createElement('stop', { offset: '0', 'stop-color': 'red' });
      const stop2 = createElement('stop', { offset: '1', 'stop-color': 'blue' });
      element.appendChild(stop1);
      element.appendChild(stop2);

      const result = parseElement(element, { warn: mockWarn }) as SvgLinearGradientNode;

      expect(result).not.toBeNull();
      expect(result.type).toBe('lineargradient');
      expect(result.x1).toBe(0);
      expect(result.y1).toBe(0);
      expect(result.x2).toBe(1);
      expect(result.y2).toBe(0);
      expect(result.stops).toHaveLength(2);
      expect(result.stops[0].offset).toBe(0);
      expect(result.stops[0].color).toBe('red');
      expect(result.stops[1].offset).toBe(1);
      expect(result.stops[1].color).toBe('blue');
    });

    it('should parse gradient with default values', () => {
      const element = createElement('linearGradient');
      const stop = createElement('stop', { offset: '0.5', 'stop-color': 'green' });
      element.appendChild(stop);

      const result = parseElement(element, { warn: mockWarn }) as SvgLinearGradientNode;

      expect(result.x1).toBe(0);
      expect(result.y1).toBe(0);
      expect(result.x2).toBe(1);
      expect(result.y2).toBe(0);
      expect(result.gradientUnits).toBe('objectBoundingBox');
      expect(result.spreadMethod).toBeUndefined();
    });

    it('should parse gradient with userSpaceOnUse units', () => {
      const element = createElement('linearGradient', {
        gradientUnits: 'userSpaceOnUse'
      });

      const result = parseElement(element, { warn: mockWarn }) as SvgLinearGradientNode;

      expect(result.gradientUnits).toBe('userSpaceOnUse');
    });

    it('should parse gradient with spreadMethod', () => {
      const element = createElement('linearGradient', {
        spreadMethod: 'reflect'
      });

      const result = parseElement(element, { warn: mockWarn }) as SvgLinearGradientNode;

      expect(result.spreadMethod).toBe('reflect');
    });
  });

  describe('parseRadialGradient', () => {
    it('should parse basic radialGradient', () => {
      const element = createElement('radialGradient', {
        cx: '0.5',
        cy: '0.5',
        r: '0.5'
      });
      const stop = createElement('stop', { offset: '0', 'stop-color': 'yellow' });
      element.appendChild(stop);

      const result = parseElement(element, { warn: mockWarn }) as SvgRadialGradientNode;

      expect(result).not.toBeNull();
      expect(result.type).toBe('radialgradient');
      expect(result.cx).toBe(0.5);
      expect(result.cy).toBe(0.5);
      expect(result.r).toBe(0.5);
      expect(result.fx).toBeUndefined();
      expect(result.fy).toBeUndefined();
      expect(result.stops).toHaveLength(1);
    });

    it('should parse radialGradient with focal point', () => {
      const element = createElement('radialGradient', {
        fx: '0.3',
        fy: '0.7'
      });

      const result = parseElement(element, { warn: mockWarn }) as SvgRadialGradientNode;

      expect(result.fx).toBe(0.3);
      expect(result.fy).toBe(0.7);
    });

    it('should parse gradient with default values', () => {
      const element = createElement('radialGradient');

      const result = parseElement(element, { warn: mockWarn }) as SvgRadialGradientNode;

      expect(result.cx).toBe(0.5);
      expect(result.cy).toBe(0.5);
      expect(result.r).toBe(0.5);
    });
  });

  describe('Gradient stops parsing', () => {
    it('should parse stop with percentage offset', () => {
      const element = createElement('linearGradient');
      const stop = createElement('stop', {
        offset: '50%',
        'stop-color': 'red',
        'stop-opacity': '0.8'
      });
      element.appendChild(stop);

      const result = parseElement(element, { warn: mockWarn }) as SvgLinearGradientNode;

      expect(result.stops[0].offset).toBe(0.5);
      expect(result.stops[0].color).toBe('red');
      expect(result.stops[0].opacity).toBe(0.8);
    });

    it('should parse stop with numeric offset', () => {
      const element = createElement('linearGradient');
      const stop = createElement('stop', {
        offset: '0.25',
        'stop-color': '#ff0000'
      });
      element.appendChild(stop);

      const result = parseElement(element, { warn: mockWarn }) as SvgLinearGradientNode;

      expect(result.stops[0].offset).toBe(0.25);
      expect(result.stops[0].color).toBe('#ff0000');
    });

    it('should skip stops with invalid offset', () => {
      const element = createElement('linearGradient');
      const stop1 = createElement('stop', { offset: 'invalid', 'stop-color': 'red' });
      const stop2 = createElement('stop', { offset: '0.5', 'stop-color': 'blue' });
      element.appendChild(stop1);
      element.appendChild(stop2);

      const result = parseElement(element, { warn: mockWarn }) as SvgLinearGradientNode;

      expect(result.stops).toHaveLength(1);
      expect(result.stops[0].color).toBe('blue');
    });

    it('should default stop color to black', () => {
      const element = createElement('linearGradient');
      const stop = createElement('stop', { offset: '0' });
      element.appendChild(stop);

      const result = parseElement(element, { warn: mockWarn }) as SvgLinearGradientNode;

      expect(result.stops[0].color).toBe('#000000');
    });
  });

  describe('Transform matrix parsing', () => {
    it('should parse transform and store matrix', () => {
      const element = createElement('rect', {
        transform: 'translate(10, 20)'
      });

      const result = parseElement(element, { warn: mockWarn });

      expect(result?.transform).toBe('translate(10, 20)');
      expect(result?.transformMatrix).toEqual({
        a: 1, b: 0, c: 0, d: 1, e: 10, f: 20
      });
    });

    it('should handle complex transforms', () => {
      const element = createElement('rect', {
        transform: 'rotate(45) scale(2)'
      });

      const result = parseElement(element, { warn: mockWarn });

      expect(result?.transform).toBe('rotate(45) scale(2)');
      expect(result?.transformMatrix).not.toBeUndefined();
      // Matrix should be the combination of rotate and scale
    });

    it('should handle invalid transforms gracefully', () => {
      const element = createElement('rect', {
        transform: 'invalid-transform'
      });

      const result = parseElement(element, { warn: mockWarn });

      expect(result?.transform).toBe('invalid-transform');
      expect(result?.transformMatrix).toBeUndefined();
    });

    it('should handle missing transform', () => {
      const element = createElement('rect');

      const result = parseElement(element, { warn: mockWarn });

      expect(result?.transform).toBeUndefined();
      expect(result?.transformMatrix).toBeUndefined();
    });
  });
});
