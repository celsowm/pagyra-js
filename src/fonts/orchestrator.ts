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

    return unifiedFont;
  }

  getSupportedFormats(): FontFormat[] {
    return Array.from(this.engines.keys());
  }
}
