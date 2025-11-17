import { parseTtfBuffer } from '../../pdf/font/ttf-lite.js';
import type { TtfFontMetrics } from '../../types/fonts.js';
import type { UnifiedFont, FontFormat } from '../types.js';

export class TtfEngine {
  parse(fontData: Uint8Array): TtfFontMetrics {
    const arrayBuffer = new ArrayBuffer(fontData.length);
    const view = new Uint8Array(arrayBuffer);
    view.set(fontData);
    return parseTtfBuffer(arrayBuffer);
  }

  convertToUnified(parsedFont: TtfFontMetrics): UnifiedFont {
    return {
      metrics: {
        metrics: parsedFont.metrics,
        glyphMetrics: parsedFont.glyphMetrics,
        cmap: parsedFont.cmap,
        headBBox: parsedFont.headBBox,
      },
      program: {
        sourceFormat: 'ttf' as FontFormat,
        getRawTableData: undefined, // TTF engine doesn't have raw table access
        getGlyphOutline: parsedFont.getGlyphOutline,
      },
    };
  }
}
