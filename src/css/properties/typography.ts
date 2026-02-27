import type { LineHeightValue } from "../line-height.js";
import type { WhiteSpace, TextWrap, WritingMode } from "../enums.js";
import type { ContentValue } from "../parsers/content-parser.js";

export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";
export type OverflowWrap = "normal" | "break-word" | "anywhere";
export type WordBreak = "normal" | "break-all" | "keep-all" | "break-word";

/**
 * font-variant-numeric values as defined in CSS Fonts Level 3
 */
export type FontVariantNumeric =
    | "normal"
    | "tabular-nums"
    | "slashed-zero"
    | "ordinal"
    | "lining-nums"
    | "oldstyle-nums"
    | "proportional-nums"
    | "diagonal-fractions"
    | "stacked-fractions";

/**
 * Parse font-variant-numeric value (can be space-separated list)
 */
export function parseFontVariantNumeric(value: string): FontVariantNumeric[] {
    const normalized = value.toLowerCase().trim();
    if (normalized === "normal") {
        return ["normal"];
    }
    const values = normalized.split(/\s+/);
    const result: FontVariantNumeric[] = [];
    const validValues: FontVariantNumeric[] = [
        "tabular-nums",
        "slashed-zero",
        "ordinal",
        "lining-nums",
        "oldstyle-nums",
        "proportional-nums",
        "diagonal-fractions",
        "stacked-fractions",
    ];
    for (const v of values) {
        if (validValues.includes(v as FontVariantNumeric)) {
            result.push(v as FontVariantNumeric);
        }
    }
    return result.length > 0 ? result : ["normal"];
}

/**
 * Check if font-variant-numeric includes a specific value
 */
export function hasFontVariantNumeric(
    values: FontVariantNumeric[],
    check: FontVariantNumeric
): boolean {
    return values.includes("normal") ? false : values.includes(check);
}

/**
 * Typography and text-related CSS properties.
 * Handles font styling, text formatting, and text layout.
 */
export interface TypographyProperties {
    /** Font size in pixels */
    fontSize: number;

    /** Font family name or stack */
    fontFamily?: string;

    /** Font weight (100-900) */
    fontWeight?: number;

    /** Font style (normal, italic, oblique) */
    fontStyle?: string;

    /** Font variant (normal, small-caps) */
    fontVariant?: string;

    /** Font variant numeric features (tabular-nums, slashed-zero, ordinal, etc.) */
    fontVariantNumeric?: FontVariantNumeric[];

    /** Generated content for pseudo-elements (content property) */
    content?: ContentValue[];

    /** Line height (absolute or relative) */
    lineHeight: LineHeightValue;

    /** Letter spacing in pixels */
    letterSpacing: number;

    /** Word spacing in pixels */
    wordSpacing: number;

    /** Horizontal text alignment */
    textAlign?: string;

    /** Text indentation */
    textIndent: import("../length.js").LengthLike;

    /** Text transformation (uppercase, lowercase, etc.) */
    textTransform: TextTransform;

    /** Text decoration line (underline, line-through, etc.) */
    textDecorationLine?: string;

    /** Text decoration color */
    textDecorationColor?: string;

    /** Text decoration style (solid, dashed, etc.) */
    textDecorationStyle?: string;

    /** Vertical alignment */
    verticalAlign?: string;

    /** White space handling */
    whiteSpace: WhiteSpace;

    /** Text wrapping mode */
    textWrap: TextWrap;

    /** Overflow wrap behavior */
    overflowWrap: OverflowWrap;

    /** Word break behavior */
    wordBreak: WordBreak;

    /** Writing mode (horizontal-tb, vertical-rl, etc.) */
    writingMode: WritingMode;

    /** Text color */
    color?: string;
}
