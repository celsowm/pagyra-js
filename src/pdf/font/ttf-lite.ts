import { readFileSync } from "fs";
import { TtfFontMetrics } from "../../types/fonts.js";
import { TtfTableParser } from "./ttf-table-parser.js";
import { parseGlobalMetrics } from "./ttf-global-metrics.js";
import { parseGlyphMetrics } from "./ttf-glyph-metrics.js";
import { CmapParser } from "./ttf-cmap.js";
import { createGlyfOutlineProvider } from "./ttf-glyf.js";
import type { KerningMap } from "../../types/fonts.js";

export function parseTtfBuffer(buffer: ArrayBuffer): TtfFontMetrics {
  const parser = new TtfTableParser(buffer);

  // Parse global metrics (head, hhea, OS/2)
  const { metrics, numberOfHMetricsRaw, headBBox } = parseGlobalMetrics(parser);

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
  const kerning = mergeKerningMaps(parseKerningTable(parser), parseGposKerning(parser));

  const glyfProvider = createGlyfOutlineProvider(parser);
  return new TtfFontMetrics(metrics, glyphMetrics, cmap, headBBox, glyfProvider, kerning);
}

export function parseTtfFont(filePath: string): TtfFontMetrics {
  const buffer = readFileSync(filePath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return parseTtfBuffer(arrayBuffer);
}

/**
 * Parse the 'kern' table (format 0) into a nested map of adjustments in font units.
 * Returns undefined when the table is missing or unsupported.
 */
function parseKerningTable(parser: TtfTableParser): KerningMap | undefined {
  const KERN = 0x6b65726e; // 'kern'
  const table = parser.getTable(KERN);
  if (!table) return undefined;

  // kern header: version (uint16), nTables (uint16)
  if (table.byteLength < 4) return undefined;
  const nTables = table.getUint16(2, false);
  let offset = 4;
  const result: KerningMap = new Map();

  for (let i = 0; i < nTables; i++) {
    if (offset + 6 > table.byteLength) break;
    const subtableVersion = table.getUint16(offset, false);
    const length = table.getUint16(offset + 2, false);
    const coverage = table.getUint16(offset + 4, false);
    const format = coverage >> 8;
    // Only support format 0 (uni-directional kerning pairs)
    if (subtableVersion === 0 && format === 0) {
      if (offset + length > table.byteLength) break;
      const stOffset = offset + 6;
      if (stOffset + 8 > table.byteLength) break;
      const pairCount = table.getUint16(stOffset, false);
      // skip searchRange, entrySelector, rangeShift (next 6 bytes)
      let cursor = stOffset + 8;
      for (let p = 0; p < pairCount; p++) {
        if (cursor + 6 > table.byteLength) break;
        const left = table.getUint16(cursor, false);
        const right = table.getUint16(cursor + 2, false);
        const value = table.getInt16(cursor + 4, false);
        if (value !== 0) {
          const rightMap = result.get(left) ?? new Map<number, number>();
          rightMap.set(right, value);
          result.set(left, rightMap);
        }
        cursor += 6;
      }
    }
    offset += length;
  }

  return result.size > 0 ? result : undefined;
}

/**
 * Parse GPOS PairPos (format 1) kerning into a nested map.
 * Supports value1 xAdvance/xPlacement adjustments; ignores class-based and other lookup types.
 */
function parseGposKerning(parser: TtfTableParser): KerningMap | undefined {
  const GPOS = 0x47504f53; // 'GPOS'
  const table = parser.getTable(GPOS);
  if (!table) return undefined;

  // Header
  if (table.byteLength < 10) return undefined;
  const gposStart = 0;
  const lookupListOffset = table.getUint16(gposStart + 8, false);
  if (lookupListOffset === 0 || lookupListOffset >= table.byteLength) return undefined;

  const kerning: KerningMap = new Map();

  // Lookup list
  const lookupCount = table.getUint16(gposStart + lookupListOffset, false);
  let lookupOffsetsPos = gposStart + lookupListOffset + 2;
  for (let li = 0; li < lookupCount; li++) {
    if (lookupOffsetsPos + 2 > table.byteLength) break;
    const lookupOffset = table.getUint16(lookupOffsetsPos, false);
    lookupOffsetsPos += 2;
    if (lookupOffset === 0 || gposStart + lookupOffset >= table.byteLength) continue;

    const lookupStart = gposStart + lookupOffset;
    if (lookupStart + 6 > table.byteLength) continue;
    const lookupType = table.getUint16(lookupStart, false);
    const subTableCount = table.getUint16(lookupStart + 4, false);
    let subTableOffsetsPos = lookupStart + 6;

    if (lookupType !== 2) {
      // Only Pair Adjustment lookups
      continue;
    }

    for (let si = 0; si < subTableCount; si++) {
      if (subTableOffsetsPos + 2 > table.byteLength) break;
      const stOffset = table.getUint16(subTableOffsetsPos, false);
      subTableOffsetsPos += 2;
      if (stOffset === 0 || lookupStart + stOffset >= table.byteLength) continue;
      const stStart = lookupStart + stOffset;
      if (stStart + 10 > table.byteLength) continue;

      const format = table.getUint16(stStart, false);
      if (format !== 1) {
        // Only handle PairPos format 1 (per-glyph pair sets)
        continue;
      }

      const coverageOffset = table.getUint16(stStart + 2, false);
      const valueFormat1 = table.getUint16(stStart + 4, false);
      const valueFormat2 = table.getUint16(stStart + 6, false);
      const pairSetCount = table.getUint16(stStart + 8, false);

      const coverage = parseCoverageTable(table, stStart + coverageOffset);
      const pairSetOffsetsStart = stStart + 10;

      for (let pi = 0; pi < pairSetCount; pi++) {
        const leftGlyph = coverage[pi];
        if (leftGlyph === undefined) continue;

        const pairSetOffsetPos = pairSetOffsetsStart + pi * 2;
        if (pairSetOffsetPos + 2 > table.byteLength) break;
        const pairSetOffset = table.getUint16(pairSetOffsetPos, false);
        if (pairSetOffset === 0 || stStart + pairSetOffset >= table.byteLength) continue;

        const pairSetStart = stStart + pairSetOffset;
        if (pairSetStart + 2 > table.byteLength) continue;
        const pairValueCount = table.getUint16(pairSetStart, false);
        let recPos = pairSetStart + 2;

        for (let r = 0; r < pairValueCount; r++) {
          if (recPos + 2 > table.byteLength) break;
          const rightGlyph = table.getUint16(recPos, false);
          recPos += 2;

          const val1 = readValueRecord(table, recPos, valueFormat1);
          recPos += val1.length;

          const val2 = readValueRecord(table, recPos, valueFormat2);
          recPos += val2.length;

          const adjust = (val1.xAdvance ?? 0) + (val1.xPlacement ?? 0) + (val2.xPlacement ?? 0);
          if (adjust !== 0) {
            const rightMap = kerning.get(leftGlyph) ?? new Map<number, number>();
            rightMap.set(rightGlyph, adjust);
            kerning.set(leftGlyph, rightMap);
          }
        }
      }
    }
  }

  return kerning.size > 0 ? kerning : undefined;
}

function parseCoverageTable(table: DataView, offset: number): number[] {
  if (offset + 4 > table.byteLength) return [];
  const format = table.getUint16(offset, false);
  if (format === 1) {
    const count = table.getUint16(offset + 2, false);
    const glyphs: number[] = [];
    let pos = offset + 4;
    for (let i = 0; i < count; i++) {
      if (pos + 2 > table.byteLength) break;
      glyphs.push(table.getUint16(pos, false));
      pos += 2;
    }
    return glyphs;
  }
  if (format === 2) {
    const rangeCount = table.getUint16(offset + 2, false);
    const glyphs: number[] = [];
    let pos = offset + 4;
    for (let i = 0; i < rangeCount; i++) {
      if (pos + 6 > table.byteLength) break;
      const start = table.getUint16(pos, false);
      const end = table.getUint16(pos + 2, false);
      const startCoverage = table.getUint16(pos + 4, false);
      for (let g = 0; g <= end - start; g++) {
        glyphs[startCoverage + g] = start + g;
      }
      pos += 6;
    }
    return glyphs;
  }
  return [];
}

function readValueRecord(table: DataView, offset: number, valueFormat: number): { xAdvance?: number; xPlacement?: number; length: number } {
  let pos = offset;
  let xPlacement: number | undefined;
  let xAdvance: number | undefined;

  const consume = (_flag: number) => {
    const v = table.getInt16(pos, false);
    pos += 2;
    return v;
  };

  if (valueFormat & 0x0001) xPlacement = consume(0x0001);
  if (valueFormat & 0x0002) consume(0x0002); // yPlacement (ignored)
  if (valueFormat & 0x0004) xAdvance = consume(0x0004);
  if (valueFormat & 0x0008) consume(0x0008); // yAdvance (ignored)

  // Skip Device/Variation tables if present (we don't apply them; consume offsets)
  const deviceFlags = [0x0010, 0x0020, 0x0040, 0x0080];
  for (const flag of deviceFlags) {
    if (valueFormat & flag) {
      pos += 2;
    }
  }

  return { xAdvance, xPlacement, length: pos - offset };
}

function mergeKerningMaps(a?: KerningMap, b?: KerningMap): KerningMap | undefined {
  if (!a && !b) return undefined;
  const result: KerningMap = new Map();
  const add = (map?: KerningMap) => {
    if (!map) return;
    for (const [left, rights] of map.entries()) {
      const target = result.get(left) ?? new Map<number, number>();
      for (const [right, val] of rights.entries()) {
        target.set(right, (target.get(right) ?? 0) + val);
      }
      result.set(left, target);
    }
  };
  add(a);
  add(b);
  return result;
}
