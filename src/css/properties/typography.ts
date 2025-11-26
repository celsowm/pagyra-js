import type { LineHeightValue } from "../line-height.js";
import type { WhiteSpace, TextWrap, WritingMode } from "../enums.js";

export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";
export type OverflowWrap = "normal" | "break-word" | "anywhere";

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

    /** Writing mode (horizontal-tb, vertical-rl, etc.) */
    writingMode: WritingMode;

    /** Text color */
    color?: string;
}
