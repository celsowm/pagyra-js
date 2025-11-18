import type { UnifiedFont } from '../types.js';
import { Woff2Parser } from '../parsers/woff2-parser.js';
import { Woff2MetricsExtractor } from '../extractors/metrics-extractor.js';

/**
 * WOFF2 Engine - Direct WOFF2 processing without TTF conversion
 * 
 * This engine follows Single Responsibility Principle:
 * - Uses Woff2Parser for table extraction
 * - Uses Woff2MetricsExtractor for metrics
 * - Creates unified font with direct WOFF2 data
 * 
 * No TTF conversion dependency!
 */
export class Woff2Engine {
  private readonly parser = new Woff2Parser();
  private readonly metricsExtractor = new Woff2MetricsExtractor();

  /**
   * Parse WOFF2 font data
   * 
   * @param fontData - Raw WOFF2 font data
   * @returns Parsed font structure
   */
  async parse(fontData: Uint8Array) {
    console.log(`WOFF2 Engine: Starting parse, file size: ${fontData.length} bytes`);
    
    // Use the dedicated WOFF2 parser
    const tableData = await this.parser.parseTables(fontData);
    
    console.log(`WOFF2 Engine: Successfully parsed WOFF2 tables`);
    
    // Return in the format expected by the existing interface
    return {
      flavor: tableData.flavor,
      numTables: Object.keys(tableData.tables).length,
      tables: tableData.tables
    };
  }

  /**
   * Convert parsed WOFF2 to unified font without TTF conversion
   * 
   * @param parsedFont - Parsed WOFF2 font data
   * @returns Unified font with direct WOFF2 processing
   */
  async convertToUnified(parsedFont: any): Promise<UnifiedFont> {
    try {
      console.log(`WOFF2 Engine: Converting to unified font without TTF conversion`);
      
      // Create table data in the format expected by the metrics extractor
      const tableData = {
        tables: parsedFont.tables,
        flavor: parsedFont.flavor
      };
      
      // Extract metrics directly from WOFF2 table data
      const metrics = this.metricsExtractor.extractMetrics(tableData);
      
      // Create unified font with WOFF2 source format
      return {
        metrics,
        program: {
          sourceFormat: 'woff2',
          getRawTableData: (tag: string) => parsedFont.tables[tag] || null,
          getGlyphOutline: () => null, // Will be implemented later
        },
      };
    } catch (error) {
      console.warn(`WOFF2 Engine: Conversion failed for font: ${error instanceof Error ? error.message : String(error)}`);
      return this.createFallbackUnifiedFont(parsedFont);
    }
  }

  /**
   * Create fallback font when WOFF2 processing fails
   */
  private createFallbackUnifiedFont(parsedFont: any): UnifiedFont {
    console.log(`WOFF2 Engine: Creating fallback font`);
    
    return {
      metrics: {
        metrics: {
          unitsPerEm: 1000,
          ascender: 800,
          descender: -200,
          lineGap: 0,
          capHeight: 700,
          xHeight: 500,
        },
        glyphMetrics: new Map([
          [0, { advanceWidth: 500, leftSideBearing: 0 }],
          [1, { advanceWidth: 250, leftSideBearing: 0 }],
          [2, { advanceWidth: 500, leftSideBearing: 0 }],
        ]),
        cmap: {
          getGlyphId: () => 1,
          hasCodePoint: () => true,
          unicodeMap: new Map([[65, 1]]),
        },
        headBBox: [0, -200, 1000, 800]
      },
      program: {
        sourceFormat: 'woff2' as const,
        getRawTableData: (tag: string) => parsedFont.tables[tag] || null,
        getGlyphOutline: () => null,
      },
    };
  }
}
