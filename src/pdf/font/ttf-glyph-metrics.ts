import type { GlyphMetrics } from "../../types/fonts.js";
import { TtfTableParser } from "./ttf-table-parser.js";

// Table tags
const HMTX = 0x686d7478; // 'hmtx'

export function parseGlyphMetrics(
  parser: TtfTableParser,
  numberOfHMetrics: number,
  numGlyphs: number
): Map<number, GlyphMetrics> {
  const hmtxTable = parser.getTable(HMTX);
  if (!hmtxTable) throw new Error("Missing hmtx table");

  const glyphMetrics = new Map<number, GlyphMetrics>();

  // Validate long metrics length
  const longBytes = numberOfHMetrics * 4;
  if (hmtxTable.byteLength < longBytes) {
    throw new Error("Truncated hmtx long metrics");
  }

  // Read first numberOfHMetrics entries (advanceWidth + lsb)
  let lastAdvanceWidth = 0;
  for (let gid = 0; gid < numGlyphs; gid++) {
    if (gid < numberOfHMetrics) {
      const off = gid * 4;
      if (off + 4 > hmtxTable.byteLength) throw new Error("Truncated hmtx entry");
      const advanceWidth = parser.getUint16(hmtxTable, off);
      const leftSideBearing = parser.getInt16(hmtxTable, off + 2);
      glyphMetrics.set(gid, { advanceWidth, leftSideBearing });
      lastAdvanceWidth = advanceWidth;
    } else {
      // LSBs follow after long metrics
      const lsbOff = longBytes + (gid - numberOfHMetrics) * 2;
      if (lsbOff + 2 > hmtxTable.byteLength) throw new Error("Truncated hmtx LSB array");
      const leftSideBearing = parser.getInt16(hmtxTable, lsbOff);
      glyphMetrics.set(gid, { advanceWidth: lastAdvanceWidth, leftSideBearing });
    }
  }

  return glyphMetrics;
}
