import type { DataViewReader } from "./ttf-table-provider.js";

/**
 * Glyph offset range in the glyf table.
 */
export interface GlyphOffsetRange {
    start: number;
    end: number;
}

/**
 * Reads and manages glyph offsets from the TrueType 'loca' table.
 * 
 * The loca (location) table maps glyph IDs to byte offsets in the glyf table.
 * It supports two formats:
 * - Format 0: Short offsets (uint16), actual offset = value * 2
 * - Format 1: Long offsets (uint32)
 */
export class LocaTableReader {
    private readonly offsets: number[];

    /**
     * Creates a new LocaTableReader.
     * @param locaTable - DataView of the loca table
     * @param indexToLocFormat - Format: 0 for short offsets, 1 for long offsets
     * @param reader - Binary data reader
     */
    constructor(
        locaTable: DataView,
        indexToLocFormat: number,
        reader: DataViewReader
    ) {
        this.offsets = [];

        try {
            if (indexToLocFormat === 0) {
                // Short format: uint16 entries, actual offset = entry * 2
                const entryCount = locaTable.byteLength / 2;
                for (let i = 0; i < entryCount; i++) {
                    const v = reader.getUint16(locaTable, i * 2);
                    this.offsets.push(v * 2);
                }
            } else {
                // Long format: uint32 entries
                const entryCount = locaTable.byteLength / 4;
                for (let i = 0; i < entryCount; i++) {
                    const v = reader.getUint32(locaTable, i * 4);
                    this.offsets.push(v);
                }
            }
        } catch {
            // Malformed loca table - leave offsets empty
            this.offsets = [];
        }
    }

    /**
     * Gets the byte offset range for a glyph in the glyf table.
     * @param glyphId - The glyph ID
     * @returns Offset range or null if invalid glyph ID
     */
    getGlyphOffset(glyphId: number): GlyphOffsetRange | null {
        if (glyphId < 0 || glyphId >= this.offsets.length - 1) {
            return null;
        }

        const start = this.offsets[glyphId];
        const end = this.offsets[glyphId + 1];

        // Validate range
        if (start < 0 || start > end) {
            return null;
        }

        return { start, end };
    }

    /**
     * Checks if a glyph is empty (has no outline data).
     * Empty glyphs have start === end in the loca table.
     * @param glyphId - The glyph ID
     * @returns True if the glyph is empty, false otherwise
     */
    isEmptyGlyph(glyphId: number): boolean {
        if (glyphId < 0 || glyphId >= this.offsets.length - 1) {
            return true;
        }

        return this.offsets[glyphId] === this.offsets[glyphId + 1];
    }

    /**
     * Gets the total number of glyphs in the font.
     * @returns Number of glyphs
     */
    getGlyphCount(): number {
        return Math.max(0, this.offsets.length - 1);
    }

    /**
     * Validates that a glyph offset range is within the glyf table bounds.
     * @param range - The offset range to validate
     * @param glyfTableSize - Size of the glyf table in bytes
     * @returns True if valid, false otherwise
     */
    validateRange(range: GlyphOffsetRange, glyfTableSize: number): boolean {
        return range.start >= 0 && range.end <= glyfTableSize && range.start <= range.end;
    }
}
