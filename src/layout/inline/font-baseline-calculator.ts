import type { FontMetrics } from "../../fonts/types.js";

/**
 * Default ascent ratio for fonts when metrics are unavailable.
 * Most fonts have an ascent around 75-80% of the font size.
 */
const DEFAULT_ASCENT_RATIO = 0.75;

/**
 * Calculate the baseline position for a line of text.
 * 
 * The baseline is the invisible line on which text sits. In proper typography,
 * the baseline should be positioned based on the font's ascent (the height
 * above the baseline where ascenders like 'h', 'b' extend).
 * 
 * When line-height is larger than font-size, we need to account for "half-leading"
 * (the extra space distributed equally above and below the text).
 * 
 * @param lineTop - The Y coordinate of the top of the line box
 * @param fontSize - The font size in pixels
 * @param lineHeight - The line height in pixels
 * @param fontMetrics - Optional font metrics for precise calculations
 * @returns The Y coordinate of the baseline
 */
export function calculateBaseline(
    lineTop: number,
    fontSize: number,
    lineHeight: number,
    fontMetrics?: FontMetrics | null
): number {
    let ascent: number;

    if (fontMetrics) {
        // Use actual font metrics when available
        const { metrics } = fontMetrics;
        const unitsPerEm = metrics.unitsPerEm;
        const ascentUnits = metrics.ascender;

        // Convert font units to pixels
        ascent = (ascentUnits / unitsPerEm) * fontSize;
    } else {
        // Use heuristic when font metrics unavailable
        ascent = fontSize * DEFAULT_ASCENT_RATIO;
    }

    // Calculate half-leading (extra space above/below the text)
    const leading = lineHeight - fontSize;
    const halfLeading = leading / 2;

    // Baseline is at: lineTop + halfLeading + ascent
    return lineTop + halfLeading + ascent;
}

/**
 * Get font metrics ascent ratio for a given font.
 * Returns the ratio of ascent to font size.
 * 
 * @param fontMetrics - Font metrics
 * @returns Ascent ratio (typically 0.7-0.9)
 */
export function getAscentRatio(fontMetrics: FontMetrics): number {
    const { metrics } = fontMetrics;
    return metrics.ascender / metrics.unitsPerEm;
}

/**
 * Get font metrics descent ratio for a given font.
 * Returns the ratio of descent to font size (negative value).
 * 
 * @param fontMetrics - Font metrics
 * @returns Descent ratio (typically -0.2 to -0.3)
 */
export function getDescentRatio(fontMetrics: FontMetrics): number {
    const { metrics } = fontMetrics;
    return metrics.descender / metrics.unitsPerEm;
}
