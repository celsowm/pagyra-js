import type { TtfMetrics } from "../../types/fonts.js";
import { TtfTableParser } from "./ttf-table-parser.js";

// Table tags
const HEAD = 0x68656164; // 'head'
const HHEA = 0x68686561; // 'hhea'
const OS_2 = 0x4f532f32; // 'OS/2'

export function parseGlobalMetrics(parser: TtfTableParser): { metrics: TtfMetrics; numberOfHMetricsRaw: number; headBBox?: readonly [number, number, number, number] } {
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

  // Only use OS/2 capHeight/xHeight if the table exists and version >= 2 (fields present)
  if (os2Table && os2Table.byteLength >= 4) {
    const os2Version = parser.getUint16(os2Table, 0);
    if (os2Version >= 2 && os2Table.byteLength >= 96) {
      capHeight = parser.getInt16(os2Table, 88);
      xHeight = parser.getInt16(os2Table, 86);
    }
  }

  // Read head bbox (xMin, yMin, xMax, yMax) if present
  let headBBox: readonly [number, number, number, number] | undefined = undefined;
  // head table contains bbox at offsets 36..42 (int16)
  if (headTable.byteLength >= 44) {
    const xMin = parser.getInt16(headTable, 36);
    const yMin = parser.getInt16(headTable, 38);
    const xMax = parser.getInt16(headTable, 40);
    const yMax = parser.getInt16(headTable, 42);
    headBBox = [xMin, yMin, xMax, yMax];
  }

  const metrics: TtfMetrics = {
    unitsPerEm,
    ascender,
    descender,
    lineGap,
    capHeight,
    xHeight
  };

  return { metrics, numberOfHMetricsRaw, headBBox };
}
