import { readFileSync } from "fs";
import type { TtfMetrics, GlyphMetrics, CmapData } from "../../types/fonts.js";
import { TtfFontMetrics } from "../../types/fonts.js";
import { TtfTableParser } from "./ttf-table-parser.js";
import { parseGlobalMetrics } from "./ttf-global-metrics.js";
import { parseGlyphMetrics } from "./ttf-glyph-metrics.js";
import { CmapParser } from "./ttf-cmap.js";
import { TtfTableParser as _TTP } from "./ttf-table-parser.js"; // ensure TS sees .js import style

export function parseTtfBuffer(buffer: ArrayBuffer): TtfFontMetrics {
  const parser = new TtfTableParser(buffer);

  // Parse global metrics (head, hhea, OS/2)
  const { metrics, numberOfHMetricsRaw } = parseGlobalMetrics(parser);

  // Parse maxp for numGlyphs
  const MAXP = 0x6d617870; // 'maxp'
  const maxpTable = parser.getTable(MAXP);
  if (!maxpTable) throw new Error("Missing maxp table");

  const numGlyphs = parser.getUint16(maxpTable, 4);

  // Clamp numberOfHMetrics to glyph count
  const numberOfHMetrics = Math.min(numberOfHMetricsRaw, numGlyphs);

  // Parse glyph metrics
  const glyphMetrics = parseGlyphMetrics(parser, numberOfHMetrics, numGlyphs);

  // Parse cmap
  const CMAP = 0x636d6170; // 'cmap'
  const cmapTable = parser.getTable(CMAP);
  if (!cmapTable) throw new Error("Missing cmap table");

  const cmap = new CmapParser(parser, cmapTable);

  return new TtfFontMetrics(metrics, glyphMetrics, cmap);
}

export function parseTtfFont(filePath: string): TtfFontMetrics {
  const buffer = readFileSync(filePath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return parseTtfBuffer(arrayBuffer);
}
