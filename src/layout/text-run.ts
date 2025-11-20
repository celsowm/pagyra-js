import type { UnifiedFont } from "../fonts/types.js";

/**
 * Represents a sequence of glyphs to be rendered using a specific font.
 * This replaces the previous "raw string + font family" model with a
 * precise glyph-level description.
 */
export interface GlyphRun {
    /**
     * The resolved font to be used for rendering.
     */
    font: UnifiedFont;

    /**
     * The glyph IDs in the font.
     * These must be consistent with the font's cmap and glyph metrics.
     */
    glyphIds: number[];

    /**
     * Positions for each glyph.
     * Can represent advances (x only) or precise positioning (x, y).
     * In the simplest case, this matches the advance width of each glyph.
     */
    positions: { x: number; y: number }[];

    /**
     * The original Unicode text that generated these glyphs.
     * Essential for generating the ToUnicode CMap for text extraction.
     */
    text: string;

    /**
     * The font size in points (or whatever unit the layout system uses).
     */
    fontSize: number;

    /**
     * Optional: Total width of the run.
     */
    width?: number;
}
