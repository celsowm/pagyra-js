/**
 * Logic for applying weight and style transformations to base font names.
 * 
 * This module handles the complex logic of mapping a base font name + weight + style
 * to a specific variant name (e.g., "Helvetica" + bold -> "Helvetica-Bold").
 * It handles both Base14 standard fonts and generic font naming conventions.
 */

import { isBoldFontWeight } from "../../../css/font-weight.js";
import { isItalicStyle } from "../../../css/font-face-parser.js";
import {
    BASE14_FAMILY_VARIANTS,
    detectBase14Family,
    classifyBase14Variant,
    type Base14Variant,
} from "../font-config.js";

/**
 * Apply weight and style transformations to a base font name.
 * 
 * @param baseFont - The base font name (e.g., "Helvetica", "Arial")
 * @param weight - The requested font weight (100-900)
 * @param style - The requested font style ("normal", "italic", "oblique")
 * @returns The transformed font name (e.g., "Helvetica-Bold", "Arial-BoldItalic")
 */
export function applyWeightToBaseFont(baseFont: string, weight: number, style?: string): string {
    const wantsItalic = isItalicStyle(style);
    const wantsBold = isBoldFontWeight(weight);

    const base14Family = detectBase14Family(baseFont);
    if (base14Family) {
        const variants = BASE14_FAMILY_VARIANTS[base14Family];
        const currentVariant = classifyBase14Variant(baseFont);
        const targetVariant: Base14Variant =
            wantsBold && wantsItalic ? "boldItalic"
                : wantsBold ? "bold"
                    : wantsItalic ? "italic"
                        : "normal";

        if (currentVariant === targetVariant) {
            return baseFont;
        }
        return variants[targetVariant];
    }

    let result = baseFont;

    if (wantsItalic && !/-italic$/i.test(result) && !/-oblique$/i.test(result)) {
        result = `${result}-Italic`;
    }

    if (wantsBold && !/-bold$/i.test(result)) {
        if (/-italic$/i.test(result)) {
            result = result.replace(/-italic$/i, "");
        } else if (/-oblique$/i.test(result)) {
            result = result.replace(/-oblique$/i, "");
        }

        return wantsItalic ? `${result}-BoldItalic` : `${result}-Bold`;
    }

    return result;
}
