import type { TtfMetrics, GlyphMetrics, CmapData, GlyphOutlineCmd } from '../types/fonts.js';

// Raw parsed font (low-level table data)
export interface ParsedFont {
  flavor: number;
  numTables: number;
  tables: Record<string, Uint8Array>;
}

/**
 * Processed font metrics for layout and text shaping/rendering.
 * Pure data, no raw binary access.
 */
export interface FontMetrics {
  readonly metrics: TtfMetrics;
  readonly glyphMetrics: ReadonlyMap<number, GlyphMetrics>;
  readonly cmap: CmapData;
  readonly headBBox?: readonly [number, number, number, number];
}

/**
 * Low-level font program data for PDF embedding, subsetting, and glyph paths.
 * Corresponds to "font program" in PDF/TTF/OTF terminology.
 */
export interface FontProgram {
  readonly sourceFormat: FontFormat;
  readonly unitsPerEm?: number;
  readonly glyphCount?: number;
  readonly getRawTableData?: (tag: string) => Uint8Array | null;
  readonly getGlyphOutline?: (gid: number) => GlyphOutlineCmd[] | null;
}

/**
 * CSS font-face resolution info.
 */
export interface CssFontInfo {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
}

/**
 * Loaded and unified font: ready for layout/PDF use.
 * Combines metrics + program + CSS resolution metadata.
 */
export interface LoadedFont {
  readonly metrics: FontMetrics;
  readonly program: FontProgram;
  readonly css?: CssFontInfo;
}

// Backward-compatible alias for gradual migration
export type UnifiedFont = LoadedFont;

export type FontFormat = 'ttf' | 'woff' | 'woff2' | 'otf';

export interface FontEngine<T = ParsedFont> {
  parse(fontData: Uint8Array): Promise<T> | T;
  convertToUnified(parsedFont: T): Promise<UnifiedFont> | UnifiedFont;
}

/**
 * WOFF2-specific types for enhanced separation
 */
export interface Woff2FontProgram extends FontProgram {
  readonly sourceFormat: 'woff2';
  readonly compressionInfo?: {
    type: 'woff2';
    tables: Map<string, any>;
  };
  readonly transformInfo?: {
    glyphTransformed: boolean;
    locaTransformed: boolean;
  };
}

export interface Woff2Font extends LoadedFont {
  readonly program: Woff2FontProgram;
}
