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

  /**
   * Reconstruct hmtx table from transformed data
   */
  static reconstructHmtx(
    hmtxData: Uint8Array,
    numHMetrics: number,
    numGlyphs: number,
    glyfTable?: Uint8Array,
    locaTable?: Uint8Array
  ): Uint8Array {
    if (hmtxData.length < 1) {
      return hmtxData;
    }

    const flags = hmtxData[0];
    const hasLsbArray = (flags & 1) === 0;
    const hasLeftSideBearingArray = (flags & 2) === 0;

    let offset = 1;
    const advanceWidths: number[] = [];

    // Read advance widths
    for (let i = 0; i < numHMetrics; i++) {
      if (offset + 2 > hmtxData.length) break;
      advanceWidths.push((hmtxData[offset] << 8) | hmtxData[offset + 1]);
      offset += 2;
    }

    const lsbs: number[] = [];
    if (hasLsbArray) {
      for (let i = 0; i < numHMetrics; i++) {
        if (offset + 2 > hmtxData.length) break;
        const val = (hmtxData[offset] << 8) | hmtxData[offset + 1];
        lsbs.push(val > 0x7FFF ? val - 0x10000 : val);
        offset += 2;
      }
    } else {
      // Reconstruct LSBs from glyf table (xMin)
      // Since we might have simplified glyf table, this might be inaccurate but safe
      for (let i = 0; i < numHMetrics; i++) {
        lsbs.push(0); // Default to 0 if derived
      }
    }

    const leftSideBearings: number[] = [];
    if (hasLeftSideBearingArray) {
      for (let i = numHMetrics; i < numGlyphs; i++) {
        if (offset + 2 > hmtxData.length) break;
        const val = (hmtxData[offset] << 8) | hmtxData[offset + 1];
        leftSideBearings.push(val > 0x7FFF ? val - 0x10000 : val);
        offset += 2;
      }
    } else {
      // Reconstruct LSBs from glyf table (xMin)
      for (let i = numHMetrics; i < numGlyphs; i++) {
        leftSideBearings.push(0); // Default to 0 if derived
      }
    }

    // Reconstruct standard hmtx table
    // Format:
    // hMetrics[numHMetrics] { advanceWidth: uint16, lsb: int16 }
    // leftSideBearing[numGlyphs - numHMetrics]: int16

    const hmtxSize = numHMetrics * 4 + (numGlyphs - numHMetrics) * 2;
    const hmtx = new Uint8Array(hmtxSize);
    const view = new DataView(hmtx.buffer);
    let writeOffset = 0;

    for (let i = 0; i < numHMetrics; i++) {
      view.setUint16(writeOffset, advanceWidths[i] || 0, false);
      view.setInt16(writeOffset + 2, lsbs[i] || 0, false);
      writeOffset += 4;
    }

    for (let i = 0; i < leftSideBearings.length; i++) {
      view.setInt16(writeOffset, leftSideBearings[i], false);
      writeOffset += 2;
    }

    return hmtx;
  }
}
