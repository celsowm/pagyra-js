import type { WOFF2TableEntry } from './types.js';
import { WOFF2GlyfTransform } from './woff2-glyf-transform.js';

/**
 * WOFF 2.0 table transformations
 * Specific transformations for glyf, loca, and hmtx tables
 */
export class WOFF2Transform {
  /**
   * Check if a table should be transformed
   */
  static shouldTransform(tag: string): boolean {
    return tag === 'glyf' || tag === 'loca' || tag === 'hmtx';
  }

  /**
   * Get transformation version for a table
   */
  static getTransformVersion(tag: string): number {
    switch (tag) {
      case 'glyf':
      case 'loca':
        return 0; // Version 0 for glyf/loca transformation
      case 'hmtx':
        return 0; // Version 0 for hmtx transformation
      default:
        return 255; // No transformation
    }
  }

  /**
   * Apply transformation to table data
   * Note: This is for encoding WOFF2, not typically used in this library
   */
  static transform(tag: string, data: Uint8Array, _entry: WOFF2TableEntry): Uint8Array {
    const version = this.getTransformVersion(tag);

    if (version === 255) {
      return data; // No transformation
    }

    // Encoding transformations not implemented (we only decode WOFF2)
    console.warn(`Transformation for ${tag} not implemented (encoding not supported)`);
    return data;
  }

  /**
   * Reverse transformation (for decompression)
   * This is the critical path for WOFF2 decoding
   */
  static untransform(
    tag: string, 
    data: Uint8Array, 
    entry: WOFF2TableEntry,
    allTables?: Map<string, Uint8Array>
  ): Uint8Array {
    const version = entry.transformVersion;

    // No transformation needed
    if (version === 255 || version === 3) {
      return data;
    }

    // Handle glyf/loca transformation
    if ((tag === 'glyf' || tag === 'loca') && version === 0) {
      // For glyf/loca, we need information from other tables
      // The transformation produces a 'gloc' table that contains both glyf and loca data
      // We'll handle this specially in the decompression logic
      return data;
    }

    // Other transformations not implemented
    return data;
  }

  /**
   * Calculate transformed length
   */
  static getTransformedLength(tag: string, data: Uint8Array): number | undefined {
    if (!this.shouldTransform(tag)) {
      return undefined;
    }

    // Actual implementation would calculate transformed size
    return data.length;
  }

  /**
   * Reconstruct glyf and loca tables from transformed 'gloc' data
   */
  static reconstructGlyfLoca(
    glocData: Uint8Array,
    numGlyphs: number,
    indexFormat: number
  ): { glyf: Uint8Array; loca: Uint8Array } {
    return WOFF2GlyfTransform.untransformGlyf(glocData, numGlyphs, indexFormat);
  }
}
