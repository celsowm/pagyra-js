import type { GlyphOutlineCmd } from "../../types/fonts.js";
import type { GlyphTableProvider } from "./ttf-table-provider.js";
import type { GlyphOutlineProvider } from "./composite-glyph-parser.js";
import { LocaTableReader } from "./loca-reader.js";
import { SimpleGlyphParser } from "./simple-glyph-parser.js";
import { CompositeGlyphParser } from "./composite-glyph-parser.js";

// Table tags
const LOCA = 0x6c6f6361; // 'loca'
const GLYF = 0x676c7966; // 'glyf'
const HEAD = 0x68656164; // 'head'

/**
 * Minimal TrueType glyf/loca parser.
 *
 * - Supports simple glyphs (contours with on-curve + off-curve quadratic points).
 * - Supports composite glyphs (components with transformations).
 * - Provides robust bounds checks and defensive behavior.
 *
 * Produces a function getGlyphOutline(gid) => GlyphOutlineCmd[] | null
 */

/**
 * Creates a glyph outline provider function for a TrueType font.
 * @param parser - Provider for accessing font tables and reading binary data
 * @returns Function that returns glyph outline commands for a given glyph ID
 */
export function createGlyfOutlineProvider(
  parser: GlyphTableProvider
): (gid: number) => GlyphOutlineCmd[] | null {

  // Read head table to determine loca format
  const headTable = parser.getTable(HEAD);
  if (!headTable) {
    return () => null; // Cannot determine loca format
  }

  const indexToLocFormat = readIndexToLocFormat(headTable, parser);

  // Get required tables
  const locaTable = parser.getTable(LOCA);
  const glyfTable = parser.getTable(GLYF);

  if (!locaTable || !glyfTable) {
    return () => null;
  }

  // Initialize parsers and readers
  const locaReader = new LocaTableReader(locaTable, indexToLocFormat, parser);
  const simpleParser = new SimpleGlyphParser(parser);
  const compositeParser = new CompositeGlyphParser(parser);

  /**
   * Internal recursive function for getting glyph outlines.
   * @param gid - Glyph ID
   * @param depth - Current recursion depth
   * @returns Glyph outline commands or null
   */
  const getOutlineInternal = (gid: number, depth: number = 0): GlyphOutlineCmd[] | null => {
    // Get glyph offset range from loca table
    const range = locaReader.getGlyphOffset(gid);
    if (!range) return null;

    // Check for empty glyph
    if (range.start === range.end) return null;

    // Validate range against glyf table size
    if (!locaReader.validateRange(range, glyfTable.byteLength)) return null;

    // Create DataView for this glyph's data
    const view = createGlyphView(glyfTable, range.start, range.end);
    if (!view || view.byteLength < 10) return null;

    // Read numberOfContours to determine glyph type
    const numberOfContours = view.getInt16(0, false);

    if (numberOfContours >= 0) {
      // Simple glyph
      return simpleParser.parse(view);
    } else {
      // Composite glyph
      const provider: GlyphOutlineProvider = {
        getOutline: (componentGid: number, componentDepth?: number) =>
          getOutlineInternal(componentGid, componentDepth ?? 0)
      };
      return compositeParser.parse(view, provider, depth);
    }
  };

  // Return the public provider function
  return (gid: number) => getOutlineInternal(gid, 0);
}

/**
 * Reads the indexToLocFormat field from the head table.
 * @param headTable - DataView of the head table
 * @param reader - Binary data reader
 * @returns Format value (0 = short, 1 = long)
 */
function readIndexToLocFormat(headTable: DataView, reader: GlyphTableProvider): number {
  try {
    // indexToLocFormat is at offset 50 in the head table
    return reader.getUint16(headTable, 50);
  } catch {
    return 0; // Default to short format on error
  }
}

/**
 * Creates a DataView for a specific glyph's data within the glyf table.
 * @param glyfTable - DataView of the glyf table
 * @param start - Start offset
 * @param end - End offset
 * @returns DataView for the glyph data, or null if invalid
 */
function createGlyphView(glyfTable: DataView, start: number, end: number): DataView | null {
  try {
    return new DataView(glyfTable.buffer, glyfTable.byteOffset + start, end - start);
  } catch {
    return null;
  }
}

// Re-export types for convenience
export type { GlyphTableProvider } from "./ttf-table-provider.js";
