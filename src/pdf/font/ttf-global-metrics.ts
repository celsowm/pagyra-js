import type { TtfMetrics } from "../../types/fonts.js";
import { TtfTableParser } from "./ttf-table-parser.js";

// Table tags
const HEAD = 0x68656164; // 'head'
const HHEA = 0x68686561; // 'hhea'
const OS_2 = 0x4f532f32; // 'OS/2'

export function parseGlobalMetrics(parser: TtfTableParser): { metrics: TtfMetrics; numberOfHMetricsRaw: number } {
  const headTable = parser.getTable(HEAD);
  if (!headTable) throw new Error("Missing head table");

  const unitsPerEm = parser.getUint16(headTable, 18);

  const hheaTable = parser.getTable(HHEA);
  if (!hheaTable) throw new Error("Missing hhea table");

  const ascender = parser.getInt16(hheaTable, 4);
  const descender = parser.getInt16(hheaTable, 6);
  const lineGap = parser.getInt16(hheaTable, 8);
  const numberOfHMetricsRaw = parser.getUint16(hheaTable, 34);

  // Parse OS/2 table for optional cap/x heights
  const os2Table = parser.getTable(OS_2);
  let capHeight = ascender;
  let xHeight = Math.round(ascender * 0.5);
  if (os2Table && os2Table.byteLength >= 96) {
    capHeight = parser.getInt16(os2Table, 88);
    xHeight = parser.getInt16(os2Table, 86);
  }

  const metrics: TtfMetrics = {
    unitsPerEm,
    ascender,
    descender,
    lineGap,
    capHeight,
    xHeight
  };

  return { metrics, numberOfHMetricsRaw };
}
