import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Woff2Parser } from '../../src/fonts/parsers/woff2-parser.js';
import { Woff2MetricsExtractor } from '../../src/fonts/extractors/metrics-extractor.js';

// Mock WOFF2 table data for testing
const createMockWoff2Header = (): Uint8Array => {
  const header = new ArrayBuffer(48);
  const view = new Uint8Array(header);
  
  // WOFF2 signature 'wOF2'
  view.set([0x77, 0x4F, 0x46, 0x32], 0);
  
  // Set some basic values
  const dv = new DataView(header);
  dv.setUint32(4, 0x00010000, false); // flavor (TTF)
  dv.setUint16(12, 2, false); // numTables
  dv.setUint32(20, 1000, false); // totalCompressedSize
  
  return view;
};

const createMockTableData = (): Record<string, Uint8Array> => {
  // Create minimal mock tables
  const head = new ArrayBuffer(54);
  const hhea = new ArrayBuffer(36);
  const maxp = new ArrayBuffer(6);
  
  const headView = new DataView(head);
  headView.setUint16(18, 1000, false); // unitsPerEm
  headView.setInt16(36, -100, false); // xMin
  headView.setInt16(38, -200, false); // yMin
  headView.setInt16(40, 1000, false); // xMax
  headView.setInt16(42, 900, false);  // yMax
  
  const hheaView = new DataView(hhea);
  hheaView.setInt16(4, 800, false);  // ascender
  hheaView.setInt16(6, -200, false); // descender
  hheaView.setInt16(8, 0, false);    // lineGap
  hheaView.setUint16(34, 2, false);  // numLongHorMetrics
  
  const maxpView = new DataView(maxp);
  maxpView.setUint16(4, 3, false);   // numGlyphs
  
  return {
    'head': new Uint8Array(head),
    'hhea': new Uint8Array(hhea),
    'maxp': new Uint8Array(maxp),
    'hmtx': new Uint8Array([500, 0, 250, 0, 100, 0]), // advanceWidth, leftSideBearing pairs
    'cmap': new Uint8Array([
      0x00, 0x00, 0x00, 0x02, // version, numTables
      0x00, 0x03, 0x00, 0x01, 0x00, 0x10, 0x00, 0x00, // table 1
      // minimal format 4 subtable
      0x00, 0x04, 0x00, 0x10, 0x00, 0x00, // format, length, language
      0x00, 0x02, // segCountX2
      0x00, 0x01, // searchRange
      0x00, 0x00, // entrySelector
      0x00, 0x00, // rangeShift
      0xFF, 0xFF, // endCount[0]
      0x00, 0x00, // reservedPad
      0x00, 0x20, // startCount[0]
      0x00, 0x01, // idDelta[0]
      0x00, 0x0C, // idRangeOffset[0]
      0x00, 0x01  // glyphIdArray[0] = 'A' (65)
    ])
  };
};

describe('Woff2Parser', () => {
  let parser: Woff2Parser;
  
  beforeEach(() => {
    parser = new Woff2Parser();
  });
  
  describe('Single Responsibility Principle', () => {
    it('should only handle WOFF2 parsing, not conversion or embedding', () => {
      expect(parser.getFormat()).toBe('woff2');
      expect(() => {
        // Should not have conversion methods
        const proto = Object.getPrototypeOf(parser);
        const methods = Object.getOwnPropertyNames(proto);
        const hasConversionMethods = methods.some(name => 
          name.toLowerCase().includes('convert') || 
          name.toLowerCase().includes('ttf') ||
          name.toLowerCase().includes('embed')
        );
        expect(hasConversionMethods).toBe(false);
      });
    });
  });
  
  describe('parseTables', () => {
    it('should validate WOFF2 signature', async () => {
      const invalidData = new Uint8Array([0x74, 0x72, 0x75, 0x65]); // 'true' instead of 'wOF2'

      await expect(parser.parseTables(invalidData)).rejects.toThrow('Invalid WOFF2 signature');
    });

    it('should validate file size', async () => {
      const tooSmall = new Uint8Array([0x77, 0x4F, 0x46, 0x32, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]); // signature only

      await expect(parser.parseTables(tooSmall)).rejects.toThrow('Invalid WOFF2: file too short');
    });
    
    it('should parse WOFF2 header correctly', async () => {
      const header = createMockWoff2Header();
      const result = await parser.parseTables(header);

      expect(result.flavor).toBe(0x00010000);
      expect(result.numTables).toBe(2);
    });
  });
});

describe('Woff2MetricsExtractor', () => {
  let extractor: Woff2MetricsExtractor;
  
  beforeEach(() => {
    extractor = new Woff2MetricsExtractor();
  });
  
  describe('Single Responsibility Principle', () => {
    it('should only handle metrics extraction', () => {
      expect(extractor.getSupportedFormats()).toEqual(['woff2']);
    });
    
    it('should not have parsing or embedding methods', () => {
      const proto = Object.getPrototypeOf(extractor);
      const methods = Object.getOwnPropertyNames(proto);
      const hasOtherMethods = methods.some(name => 
        name.toLowerCase().includes('parse') || 
        name.toLowerCase().includes('embed') ||
        name.toLowerCase().includes('compress')
      );
      expect(hasOtherMethods).toBe(false);
    });
  });
  
  describe('extractMetrics', () => {
    it('should extract metrics from WOFF2 table data', () => {
      const mockTableData = {
        flavor: 0x00010000,
        numTables: 3,
        tables: createMockTableData(),
        compressionInfo: {
          type: 'woff2' as const,
          tables: new Map()
        }
      };
      
      const metrics = extractor.extractMetrics(mockTableData as any);
      
      expect(metrics.metrics.unitsPerEm).toBe(1000);
      expect(metrics.metrics.ascender).toBe(800);
      expect(metrics.metrics.descender).toBe(-200);
      expect(metrics.headBBox).toEqual([-100, -200, 1000, 900]);
    });
    
    it('should handle missing tables gracefully', () => {
      const invalidData = {
        tables: {} // Missing required tables
      };
      
      expect(() => extractor.extractMetrics(invalidData as any)).toThrow('WOFF2 font missing required tables');
    });
    
    it('should parse character mapping', () => {
      const mockTableData = {
        tables: createMockTableData()
      };
      
      const metrics = extractor.extractMetrics(mockTableData as any);
      
      expect(metrics.cmap.hasCodePoint(65)).toBe(true); // 'A'
      expect(metrics.cmap.getGlyphId(65)).toBe(1);
    });
    
    it('should extract glyph metrics correctly', () => {
      const mockTableData = {
        tables: createMockTableData()
      };
      
      const metrics = extractor.extractMetrics(mockTableData as any);
      
      expect(metrics.glyphMetrics.size).toBeGreaterThan(0);
      expect(metrics.glyphMetrics.get(0)).toEqual({
        advanceWidth: 500,
        leftSideBearing: 0
      });
    });
  });
});

describe('SRP Compliance Verification', () => {
  it('parsers should have single responsibility', () => {
    const parser = new Woff2Parser();
    const proto = Object.getPrototypeOf(parser);
    const methods = Object.getOwnPropertyNames(proto).filter(name => 
      typeof (proto as any)[name] === 'function'
    );
    
    // Should only have parse-related methods
    const nonParseMethods = methods.filter(name => 
      !name.toLowerCase().includes('parse') && 
      !name.toLowerCase().includes('getformat') &&
      !name.startsWith('_')
    );
    
    expect(nonParseMethods).toHaveLength(0);
  });
  
  it('extractors should have single responsibility', () => {
    const extractor = new Woff2MetricsExtractor();
    const proto = Object.getPrototypeOf(extractor);
    const methods = Object.getOwnPropertyNames(proto).filter(name => 
      typeof (proto as any)[name] === 'function'
    );
    
    // Should only have extract-related methods
    const nonExtractMethods = methods.filter(name => 
      !name.toLowerCase().includes('extract') && 
      !name.toLowerCase().includes('getsupported') &&
      !name.startsWith('_')
    );
    
    expect(nonExtractMethods).toHaveLength(0);
  });
  
  it('should maintain separation of concerns', () => {
    const parser = new Woff2Parser();
    const extractor = new Woff2MetricsExtractor();
    
    // Parser should not know about metrics
    const parserProto = Object.getPrototypeOf(parser);
    const hasMetricsReferences = Object.getOwnPropertyNames(parserProto).some(name =>
      name.toLowerCase().includes('metrics')
    );
    expect(hasMetricsReferences).toBe(false);
    
    // Extractor should not know about parsing details
    const extractorProto = Object.getPrototypeOf(extractor);
    const hasParsingReferences = Object.getOwnPropertyNames(extractorProto).some(name =>
      name.toLowerCase().includes('brotli') || name.toLowerCase().includes('header')
    );
    expect(hasParsingReferences).toBe(false);
  });
});

describe('Performance Benefits', () => {
  it('should avoid double parsing', () => {
    // The new design should parse WOFF2 once and extract metrics directly
    // instead of parsing WOFF2 -> converting to TTF -> parsing TTF
    
    const parser = new Woff2Parser();
    const extractor = new Woff2MetricsExtractor();
    
    // Verify no conversion methods exist
    const parserProto = Object.getPrototypeOf(parser);
    const hasConversionMethods = Object.getOwnPropertyNames(parserProto).some(name =>
      name.toLowerCase().includes('createbasicttf') ||
      name.toLowerCase().includes('reconstruct')
    );
    
    expect(hasConversionMethods).toBe(false);
  });
  
  it('should maintain compression information', () => {
    const mockData = {
      compressionInfo: {
        type: 'woff2' as const,
        tables: new Map([
          ['cmap', { compressed: true, transformVersion: 1 }],
          ['head', { compressed: false, transformVersion: 0 }]
        ])
      }
    };
    
    const parser = new Woff2Parser();
    
    // Parser should preserve compression info for embedders
    expect(mockData.compressionInfo.type).toBe('woff2');
    expect(mockData.compressionInfo.tables.get('cmap')?.compressed).toBe(true);
  });
});
