import { decodeWoff } from "../woff/decoder.js";
import { reconstructTtf } from "../utils/ttf-reconstructor.js";
import type { FontFormat, ParsedFont, UnifiedFont } from "../types.js";
import { parseTtfBuffer } from "../../pdf/font/ttf-lite.js";

export class WoffEngine {
  async parse(fontData: Uint8Array): Promise<ParsedFont> {
    return decodeWoff(fontData);
  }

  convertToUnified(parsedFont: ParsedFont): UnifiedFont {
    const ttfBuffer = reconstructTtf(parsedFont);
    const metrics = parseTtfBuffer(ttfBuffer);

    // Capture raw table data for callers that need it (PDF embedding/tests)
    const tableMap = new Map<string, Uint8Array>();
    for (const [tag, data] of Object.entries(parsedFont.tables)) {
      tableMap.set(tag, data);
    }

    return {
      metrics: {
        metrics: metrics.metrics,
        glyphMetrics: metrics.glyphMetrics,
        cmap: metrics.cmap,
        headBBox: metrics.headBBox,
        kerning: metrics.kerning,
      },
      program: {
        sourceFormat: "woff" as FontFormat,
        unitsPerEm: metrics.metrics.unitsPerEm,
        glyphCount: metrics.glyphMetrics.size,
        getRawTableData: (tag: string) => tableMap.get(tag) ?? null,
        getGlyphOutline: metrics.getGlyphOutline,
      }
    };
  }
}
