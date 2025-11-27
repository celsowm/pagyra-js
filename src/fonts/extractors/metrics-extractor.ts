import type { TtfMetrics, GlyphMetrics, CmapData, GlyphOutlineCmd } from '../../types/fonts.js';
import type { FontTableData } from '../parsers/base-parser.js';

/**
 * Font Metrics Extractor - Single Responsibility: Extract font metrics from table data
 * 
 * This extractor is responsible ONLY for:
 * - Reading font metrics from table data
 * - Extracting character-to-glyph mappings
 * - Computing font-wide measurements
 * 
 * It does NOT handle:
 * - Font format parsing
 * - PDF embedding
 * - Font file I/O
 */
export interface FontMetrics {
  readonly metrics: TtfMetrics;
  readonly glyphMetrics: ReadonlyMap<number, GlyphMetrics>;
  readonly cmap: CmapData;
  readonly headBBox?: readonly [number, number, number, number];
}

/**
 * Interface for extracting metrics from any font table data
 */
export interface MetricsExtractor<T extends FontTableData = FontTableData> {
  extractMetrics(tableData: T): FontMetrics;
  getSupportedFormats(): string[];
}

/**
 * WOFF2 Metrics Extractor - Extract metrics directly from WOFF2 table data
 * 
 * This allows us to avoid TTF conversion and work directly with WOFF2 data,
 * maintaining performance and compression benefits.
 */
export class Woff2MetricsExtractor implements MetricsExtractor {
  
  getSupportedFormats(): string[] {
    return ['woff2'];
  }

  extractMetrics(tableData: any): FontMetrics {
    // Validate we have the required WOFF2 table data
    if (!tableData.tables || typeof tableData.tables !== 'object') {
      throw new Error('Invalid WOFF2 table data: missing tables');
    }

    const tables = tableData.tables;
    
    // Extract basic metrics from required tables
    const headTable = tables['head'];
    const hheaTable = tables['hhea'];
    const maxpTable = tables['maxp'];
    const nameTable = tables['name'];
    const os2Table = tables['OS/2'];

    if (!headTable || !hheaTable || !maxpTable) {
      throw new Error('WOFF2 font missing required tables (head, hhea, maxp)');
    }

    // Parse metrics from tables
    const metrics = this.parseMetrics(headTable, hheaTable, maxpTable, os2Table);
    const glyphMetrics = this.parseGlyphMetrics(tableData);
    const cmap = this.parseCharacterMap(tables['cmap']);
    const headBBox = this.parseHeadBBox(headTable);

    return {
      metrics,
      glyphMetrics,
      cmap,
      headBBox
    };
  }

  private parseMetrics(headTable: Uint8Array, hheaTable: Uint8Array, maxpTable: Uint8Array, os2Table?: Uint8Array): TtfMetrics {
    const head = new DataView(headTable.buffer, headTable.byteOffset, headTable.length);
    const hhea = new DataView(hheaTable.buffer, hheaTable.byteOffset, hheaTable.length);
    
    // Read unitsPerEm from head table (offset 18, length 2, big-endian)
    const unitsPerEm = head.getUint16(18, false);
    
    // Read ascender/descender from hhea table
    const ascender = hhea.getInt16(4, false); // offset 4, length 2, signed
    const descender = hhea.getInt16(6, false); // offset 6, length 2, signed
    
    // Read line gap from hhea table
    const lineGap = hhea.getInt16(8, false); // offset 8, length 2, signed

    // Extract additional metrics from OS/2 table if available
    let capHeight = 700; // Default fallback
    let xHeight = 500; // Default fallback
    
    if (os2Table) {
      const os2 = new DataView(os2Table.buffer, os2Table.byteOffset, os2Table.length);
      
      // OS/2 version 2+ has sCapHeight at offset 88
      if (os2Table.length >= 90) {
        try {
          capHeight = os2.getInt16(88, false);
        } catch {
          // Use default if reading fails
        }
      }
      
      // OS/2 has sxHeight at offset 86 (version 2+)
      if (os2Table.length >= 88) {
        try {
          xHeight = os2.getInt16(86, false);
        } catch {
          // Use default if reading fails
        }
      }
    }

    return {
      unitsPerEm,
      ascender,
      descender,
      lineGap,
      capHeight,
      xHeight
    };
  }

  private parseGlyphMetrics(tableData: any): ReadonlyMap<number, GlyphMetrics> {
    const tables = tableData.tables;
    const hmtxTable = tables['hmtx'];
    const maxpTable = tables['maxp'];
    
    if (!hmtxTable || !maxpTable) {
      throw new Error('WOFF2 font missing required tables for glyph metrics (hmtx, maxp)');
    }

    const maxp = new DataView(maxpTable.buffer, maxpTable.byteOffset, maxpTable.length);
    const numGlyphs = maxp.getUint16(4, false); // offset 4, length 2
    
    const hmtx = new DataView(hmtxTable.buffer, hmtxTable.byteOffset, hmtxTable.length);
    const glyphMetrics = new Map<number, GlyphMetrics>();
    
    // hmtx format: longHorMetric[] followed by leftSideBearing[]
    // Number of longHorMetric entries = number of advance widths in hhea
    const hheaTable = tables['hhea'];
    const numLongHorMetrics = new DataView(hheaTable.buffer, hheaTable.byteOffset, hheaTable.length).getUint16(34, false);
    
    let hmtxOffset = 0;
    let lastAdvanceWidth = 0;
    
    // Process longHorMetric entries (advanceWidth + leftSideBearing)
    for (let i = 0; i < numLongHorMetrics && i < numGlyphs; i++) {
      const advanceWidth = hmtx.getUint16(hmtxOffset, false);
      const leftSideBearing = hmtx.getInt16(hmtxOffset + 2, false);
      
      glyphMetrics.set(i, {
        advanceWidth,
        leftSideBearing
      });
      
      lastAdvanceWidth = advanceWidth;
      hmtxOffset += 4; // 2 bytes advanceWidth + 2 bytes leftSideBearing
    }
    
    // Process remaining glyphs with just leftSideBearing
    // Per OpenType spec: these glyphs reuse the last advanceWidth value
    for (let i = numLongHorMetrics; i < numGlyphs; i++) {
      const leftSideBearing = hmtx.getInt16(hmtxOffset, false);
      
      glyphMetrics.set(i, {
        advanceWidth: lastAdvanceWidth,
        leftSideBearing
      });
      
      hmtxOffset += 2;
    }

    return glyphMetrics;
  }

  private parseCharacterMap(cmapTable?: Uint8Array): CmapData {
    if (!cmapTable) {
      // Return basic fallback cmap
      return {
        getGlyphId: () => 0,
        hasCodePoint: () => false,
        unicodeMap: new Map()
      };
    }

    const cmap = new DataView(cmapTable.buffer, cmapTable.byteOffset, cmapTable.length);
    
    // Parse cmap table structure
    const version = cmap.getUint16(0, false);
    const numTables = cmap.getUint16(2, false);
    
    let bestSubtable: { offset: number; length: number; format: number } | null = null;
    
    // Find the best encoding subtable (prefer format 4, then format 12)
    for (let i = 0; i < numTables; i++) {
      const tableOffset = 4 + i * 8; // Each table entry is 8 bytes
      const platformID = cmap.getUint16(tableOffset, false);
      const encodingID = cmap.getUint16(tableOffset + 2, false);
      const subtableOffset = cmap.getUint32(tableOffset + 4, false);
      
      // Read subtable format
      const subtableFormat = cmap.getUint16(subtableOffset, false);
      
      // Prefer Unicode (platformID = 0 or 3) with format 4 or 12
      const isUnicode = platformID === 0 || (platformID === 3 && encodingID === 1);
      const isPreferredFormat = subtableFormat === 4 || subtableFormat === 12;
      
      if (isUnicode && isPreferredFormat && (!bestSubtable || subtableFormat === 4)) {
        bestSubtable = {
          offset: subtableOffset,
          length: 0, // Will be computed
          format: subtableFormat
        };
        
        if (subtableFormat === 4) {
          break; // Format 4 is preferred
        }
      }
    }
    
    if (!bestSubtable) {
      // Fallback to first available subtable
      const tableOffset = 4; // First table
      const subtableOffset = cmap.getUint32(tableOffset + 4, false);
      bestSubtable = {
        offset: subtableOffset,
        length: 0,
        format: cmap.getUint16(subtableOffset, false)
      };
    }
    
    // Parse the chosen subtable
    if (bestSubtable.format === 4) {
      return this.parseCmapFormat4(cmap, bestSubtable.offset);
    } else if (bestSubtable.format === 12) {
      return this.parseCmapFormat12(cmap, bestSubtable.offset);
    } else {
      // Unsupported format - return fallback
      return {
        getGlyphId: () => 0,
        hasCodePoint: () => false,
        unicodeMap: new Map()
      };
    }
  }

  private parseCmapFormat4(cmap: DataView, offset: number): CmapData {
    const format = cmap.getUint16(offset, false);
    if (format !== 4) {
      throw new Error(`Expected format 4, got ${format}`);
    }
    
    const length = cmap.getUint16(offset + 2, false);
    const language = cmap.getUint16(offset + 4, false); // Should be 0 for Unicode
    const segCountX2 = cmap.getUint16(offset + 6, false);
    const segCount = segCountX2 / 2;
    
    const searchRange = cmap.getUint16(offset + 8, false);
    const entrySelector = cmap.getUint16(offset + 10, false);
    const rangeShift = cmap.getUint16(offset + 12, false);
    
    // Find the offset to endCodes array
    const endCodesOffset = offset + 14;
    const startCodesOffset = endCodesOffset + segCount * 2 + 2; // +2 for reservedPad
    const idDeltaOffset = startCodesOffset + segCount * 2;
    const idRangeOffsetOffset = idDeltaOffset + segCount * 2;
    
    const glyphIdArrayOffset = idRangeOffsetOffset + segCount * 2;
    
    const unicodeMap = new Map<number, number>();
    
    // Parse segments
    for (let i = 0; i < segCount; i++) {
      const endCode = cmap.getUint16(endCodesOffset + i * 2, false);
      const startCode = cmap.getUint16(startCodesOffset + i * 2, false);
      const idDelta = cmap.getUint16(idDeltaOffset + i * 2, false);
      const idRangeOffset = cmap.getUint16(idRangeOffsetOffset + i * 2, false);
      
      if (endCode === 0xFFFF) {
        break; // Last segment marker
      }
      
      if (idRangeOffset === 0) {
        // Simple case: glyphId = (unicode + idDelta) mod 65536
        for (let unicode = startCode; unicode <= endCode; unicode++) {
          const glyphId = (unicode + idDelta) & 0xFFFF;
          unicodeMap.set(unicode, glyphId);
        }
      } else {
        // Complex case: use idRangeOffset
        const glyphIdOffset = idRangeOffsetOffset + i * 2 + idRangeOffset;
        
        for (let unicode = startCode; unicode <= endCode; unicode++) {
          const offsetInRange = glyphIdOffset + (unicode - startCode) * 2;
          const glyphId = cmap.getUint16(offsetInRange, false);
          
          if (glyphId !== 0) {
            const finalGlyphId = (glyphId + idDelta) & 0xFFFF;
            unicodeMap.set(unicode, finalGlyphId);
          }
        }
      }
    }
    
    return {
      getGlyphId: (unicode: number) => unicodeMap.get(unicode) || 0,
      hasCodePoint: (unicode: number) => unicodeMap.has(unicode),
      unicodeMap
    };
  }

  private parseCmapFormat12(cmap: DataView, offset: number): CmapData {
    const format = cmap.getUint16(offset, false);
    if (format !== 12) {
      throw new Error(`Expected format 12, got ${format}`);
    }
    
    const reserved = cmap.getUint16(offset + 2, false);
    const length = cmap.getUint32(offset + 4, false);
    const language = cmap.getUint32(offset + 8, false);
    const nGroups = cmap.getUint32(offset + 12, false);
    
    const unicodeMap = new Map<number, number>();
    
    let groupOffset = offset + 16;
    
    for (let i = 0; i < nGroups; i++) {
      const startCharCode = cmap.getUint32(groupOffset, false);
      const endCharCode = cmap.getUint32(groupOffset + 4, false);
      const startGlyphID = cmap.getUint32(groupOffset + 8, false);
      
      for (let unicode = startCharCode; unicode <= endCharCode; unicode++) {
        const glyphId = startGlyphID + (unicode - startCharCode);
        unicodeMap.set(unicode, glyphId);
      }
      
      groupOffset += 12; // Each group is 12 bytes
    }
    
    return {
      getGlyphId: (unicode: number) => unicodeMap.get(unicode) || 0,
      hasCodePoint: (unicode: number) => unicodeMap.has(unicode),
      unicodeMap
    };
  }

  private parseHeadBBox(headTable: Uint8Array): readonly [number, number, number, number] {
    const head = new DataView(headTable.buffer, headTable.byteOffset, headTable.length);
    
    // head table format: xMin, yMin, xMax, yMax at offsets 36, 38, 40, 42
    const xMin = head.getInt16(36, false);
    const yMin = head.getInt16(38, false);
    const xMax = head.getInt16(40, false);
    const yMax = head.getInt16(42, false);
    
    return [xMin, yMin, xMax, yMax];
  }
}
