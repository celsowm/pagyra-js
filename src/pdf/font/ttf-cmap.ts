import type { CmapData } from "../../types/fonts.js";
import { TtfTableParser } from "./ttf-table-parser.js";

// cmap table tags / helpers could live here if needed

export class CmapParser implements CmapData {
  public readonly unicodeMap = new Map<number, number>();

  constructor(parser: TtfTableParser, cmapTable: DataView) {
    this.parseCmapTable(parser, cmapTable);
  }

  private parseCmapTable(parser: TtfTableParser, table: DataView): void {
    if (table.byteLength < 4) throw new Error("Truncated cmap header");

    const version = table.getUint16(0, false);
    if (version !== 0) return; // only support version 0 for now

    const numSubtables = table.getUint16(2, false);
    const subtables: { platformId: number; encodingId: number; offset: number }[] = [];

    // collect subtables with bounds checks
    const expectedDirLen = 4 + numSubtables * 8;
    if (expectedDirLen > table.byteLength) throw new Error("Truncated cmap subtables directory");

    for (let i = 0; i < numSubtables; i++) {
      const subtableOffset = 4 + i * 8;
      const platformId = table.getUint16(subtableOffset, false);
      const encodingId = table.getUint16(subtableOffset + 2, false);
      const offset = table.getUint32(subtableOffset + 4, false);

      if (offset >= table.byteLength) {
        throw new Error("Invalid subtable offset in cmap");
      }

      subtables.push({ platformId, encodingId, offset });
    }

    // Selection strategy: prefer Platform 0 (Unicode) format 12/4, then Platform 3 encIDs 10/1 (format 12/4),
    // otherwise fall back to any format 4 available.
    const pickSubtable = (): { platformId: number; encodingId: number; offset: number } | null => {
      const findPreferred = (platforms: { pid: number; eids: number[] }[]) => {
        for (const p of platforms) {
          for (const st of subtables) {
            if (st.platformId !== p.pid) continue;
            if (p.eids.length > 0 && !p.eids.includes(st.encodingId)) continue;

            if (st.offset + 2 <= table.byteLength) {
              const fmt = table.getUint16(st.offset, false);
              if (fmt === 12) return st;
            }
          }
        }
        for (const p of platforms) {
          for (const st of subtables) {
            if (st.platformId !== p.pid) continue;
            if (p.eids.length > 0 && !p.eids.includes(st.encodingId)) continue;
            if (st.offset + 2 <= table.byteLength) {
              const fmt = table.getUint16(st.offset, false);
              if (fmt === 4) return st;
            }
          }
        }
        return null;
      };

      let chosen = findPreferred([{ pid: 0, eids: [] }]);
      if (chosen) return chosen;

      chosen = findPreferred([{ pid: 3, eids: [10] }, { pid: 3, eids: [1] }]);
      if (chosen) return chosen;

      for (const st of subtables) {
        if (st.offset + 2 <= table.byteLength && table.getUint16(st.offset, false) === 4) return st;
      }

      return null;
    };

    const selected = pickSubtable();
    if (!selected) {
      // No suitable cmap found — leave unicodeMap empty.
      return;
    }

    const format = table.getUint16(selected.offset, false);
    if (format === 4) {
      this.parseFormat4Table(parser, table, selected.offset);
    } else if (format === 12) {
      this.parseFormat12Table(parser, table, selected.offset);
    } else {
      // unsupported format for now; leave empty
      return;
    }
  }

  private parseFormat4Table(parser: TtfTableParser, table: DataView, offset: number): void {
    if (offset + 8 > table.byteLength) throw new Error("Truncated cmap format 4 header");
    const format = table.getUint16(offset, false);
    if (format !== 4) throw new Error("Unexpected cmap format (not 4)");

    const length = table.getUint16(offset + 2, false);
    if (offset + length > table.byteLength) throw new Error("Truncated cmap format 4 table");

    const segCountX2 = table.getUint16(offset + 6, false);
    const segCount = segCountX2 / 2;

    const endCodeOffset = offset + 14;
    const startCodeOffset = endCodeOffset + segCount * 2 + 2;
    const idDeltaOffset = startCodeOffset + segCount * 2;
    const idRangeOffsetOffset = idDeltaOffset + segCount * 2;

    if (idRangeOffsetOffset > offset + length) throw new Error("Truncated cmap format 4 arrays");

    for (let i = 0; i < segCount; i++) {
      const endCode = table.getUint16(endCodeOffset + i * 2, false);
      const startCode = table.getUint16(startCodeOffset + i * 2, false);
      const idDelta = table.getInt16(idDeltaOffset + i * 2, false); // signed
      const idRangeOffset = table.getUint16(idRangeOffsetOffset + i * 2, false);

      if (startCode === 0xffff) break;

      if (startCode > endCode) throw new Error("Invalid cmap segment (startCode > endCode)");

      for (let code = startCode; code <= endCode; code++) {
        let glyphId = 0;

        if (idRangeOffset === 0) {
          glyphId = (code + idDelta) & 0xffff;
        } else {
          const idRangeWordOffset = idRangeOffsetOffset + i * 2;
          const glyphIndexOffset = idRangeWordOffset + idRangeOffset + (code - startCode) * 2;

          if (glyphIndexOffset + 2 > offset + length) {
            throw new Error("Truncated cmap glyphIndexArray");
          }

          glyphId = table.getUint16(glyphIndexOffset, false);
          if (glyphId !== 0) {
            glyphId = (glyphId + idDelta) & 0xffff;
          }
        }

        this.unicodeMap.set(code, glyphId);
      }
    }
  }

  private parseFormat12Table(parser: TtfTableParser, table: DataView, offset: number): void {
    // Format 12 uses 32-bit fields
    if (offset + 16 > table.byteLength) throw new Error("Truncated cmap format 12 header");
    const format = table.getUint16(offset, false);
    if (format !== 12) throw new Error("Unexpected cmap format (not 12)");
    const nGroups = table.getUint32(offset + 12, false);
    const groupsOffset = offset + 16;
    const required = groupsOffset + nGroups * 12;
    if (required > table.byteLength) throw new Error("Truncated cmap format 12 groups");

    let p = groupsOffset;
    for (let g = 0; g < nGroups; g++, p += 12) {
      const startCode = table.getUint32(p, false);
      const endCode = table.getUint32(p + 4, false);
      const startGID = table.getUint32(p + 8, false);

      if (startCode > endCode) throw new Error("Invalid cmap format 12 group (startCode > endCode)");

      for (let cp = startCode; cp <= endCode; cp++) {
        this.unicodeMap.set(cp, startGID + (cp - startCode));
      }
    }
  }

  getGlyphId(codePoint: number): number {
    return this.unicodeMap.get(codePoint) ?? 0;
  }

  hasCodePoint(codePoint: number): boolean {
    return this.unicodeMap.has(codePoint);
  }
}
