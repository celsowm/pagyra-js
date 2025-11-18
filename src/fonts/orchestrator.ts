import { detectFontFormat } from './detector.js';
import { TtfEngine } from './engines/ttf-engine.js';
import { WoffEngine } from './engines/woff-engine.js';
import { Woff2Engine } from './engines/woff2-engine.js';
import type { FontFormat, UnifiedFont } from './types.js';

export class FontOrchestrator {
  private engines = new Map<FontFormat, any>();

  constructor() {
    this.engines.set('ttf', new TtfEngine());
    this.engines.set('woff', new WoffEngine());
    this.engines.set('woff2', new Woff2Engine());
    this.engines.set('otf', new TtfEngine()); // OTF uses the same engine as TTF for now
  }

  async parseFont(fontData: Uint8Array): Promise<UnifiedFont> {
    const format = detectFontFormat(fontData);
    if (!format) {
      throw new Error('Unsupported font format');
    }

    const engine = this.engines.get(format);
    if (!engine) {
      throw new Error(`No engine available for font format: ${format}`);
    }

    try {
      console.log(`FONT-ORCH: Parsing ${format} font with ${engine.constructor.name}`);

      let parsed;
      if (format === 'ttf' || format === 'otf') {
        // TTF engine works with TtfFontMetrics directly
        parsed = engine.parse(fontData);
      } else {
        // WOFF/WOFF2 engines work with ParsedFont
        parsed = await engine.parse(fontData);
      }

      let unifiedFont: UnifiedFont;
      if (format === 'ttf' || format === 'otf') {
        unifiedFont = engine.convertToUnified(parsed);
      } else {
        unifiedFont = await engine.convertToUnified(parsed);
      }

      console.log(`FONT-ORCH: Successfully parsed ${format} font`);
      return unifiedFont;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`FONT-ORCH: Failed to parse ${format} font:`, errorMessage);
      console.warn(`FONT-ORCH: Falling back to embedded font due to parsing error`);
      
      // Return fallback font instead of throwing
      return this.getFallbackFont(format);
    }
  }

  getSupportedFormats(): FontFormat[] {
    return Array.from(this.engines.keys());
  }

  private getFallbackFont(format: FontFormat): UnifiedFont {
    console.log(`FONT-ORCH: Creating fallback font for ${format} format`);
    
    return {
      metrics: {
        metrics: {
          unitsPerEm: 1000,
          ascender: 800,
          descender: -200,
          lineGap: 0,
          capHeight: 700,
          xHeight: 500,
        },
        glyphMetrics: new Map([
          [0, { advanceWidth: 500, leftSideBearing: 0 }],
          [1, { advanceWidth: 250, leftSideBearing: 0 }],
          [2, { advanceWidth: 500, leftSideBearing: 0 }],
        ]),
        cmap: {
          getGlyphId: () => 1,
          hasCodePoint: () => true,
          unicodeMap: new Map([[65, 1]]),
        },
        headBBox: [0, -200, 1000, 800]
      },
      program: {
        sourceFormat: format,
        getRawTableData: () => null,
        getGlyphOutline: () => null,
      },
    };
  }
}
