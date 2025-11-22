import { parseTtfBuffer } from "../../pdf/font/ttf-lite.js";
import type { FontFormat, ParsedFont, UnifiedFont } from "../types.js";
import { decodeWoff2 } from "../woff2/decoder.js";

type ParsedWoff2 = ParsedFont & { ttfBuffer: Uint8Array };

export class Woff2Engine {
  parse(fontData: Uint8Array): ParsedWoff2 {
    const { parsed, ttfBuffer } = decodeWoff2(fontData);
    return { ...parsed, ttfBuffer };
  }

  convertToUnified(parsedFont: ParsedWoff2): UnifiedFont {
    // Create an ArrayBuffer copy to avoid SharedArrayBuffer unions
    const ttfCopy = parsedFont.ttfBuffer.slice();
    const ttfArrayBuffer = ttfCopy.buffer;
    const metrics = parseTtfBuffer(ttfArrayBuffer);

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
        kerning: metrics.kerning
      },
      program: {
        sourceFormat: "woff2" as FontFormat,
        unitsPerEm: metrics.metrics.unitsPerEm,
        glyphCount: metrics.glyphMetrics.size,
        getRawTableData: (tag: string) => tableMap.get(tag) ?? null,
        getGlyphOutline: metrics.getGlyphOutline
      }
    };
  }
}
