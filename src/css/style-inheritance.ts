import type { ComputedStyle } from "./style.js";
import type { LineHeightValue } from "./line-height.js";
import type { OverflowWrap, TextTransform } from "./properties/typography.js";
import { cloneLineHeight } from "./line-height.js";
import type { LengthLike } from "./length.js";
import type { StyleDefaults } from "./ua-defaults/types.js";

/**
 * Inherited CSS properties passed from parent to child
 */
export interface InheritedStyleProperties {
    color?: string;
    fontSize: number;
    lineHeight: LineHeightValue;
    fontFamily?: string;
    fontStyle?: string;
    fontVariant?: string;
    fontWeight?: number;
    letterSpacing?: number;
    textDecorationLine?: string;
    textDecorationColor?: string;
    textDecorationStyle?: string;
    overflowWrap?: OverflowWrap;
    textIndent: LengthLike;
    textTransform: TextTransform;
    listStyleType: string;
}

/**
 * Style inheritance resolver
 * Responsibility: Determine which CSS properties inherit from parent
 */
export class StyleInheritanceResolver {
    /**
     * Resolve inherited properties from parent style
     */
    static resolveInheritedProperties(
        parentStyle: ComputedStyle,
        mergedDefaults: StyleDefaults
    ): InheritedStyleProperties {
        return {
            color: parentStyle.color ?? mergedDefaults.color,
            fontSize: parentStyle.fontSize,
            lineHeight: cloneLineHeight(parentStyle.lineHeight),
            fontFamily: parentStyle.fontFamily ?? mergedDefaults.fontFamily,
            fontStyle: parentStyle.fontStyle ?? mergedDefaults.fontStyle,
            fontVariant: parentStyle.fontVariant ?? mergedDefaults.fontVariant,
            fontWeight: parentStyle.fontWeight ?? mergedDefaults.fontWeight,
            letterSpacing: parentStyle.letterSpacing ?? mergedDefaults.letterSpacing,
            textDecorationLine: parentStyle.textDecorationLine ?? mergedDefaults.textDecorationLine,
            textDecorationColor: parentStyle.textDecorationColor ?? mergedDefaults.textDecorationColor,
            textDecorationStyle: parentStyle.textDecorationStyle ?? mergedDefaults.textDecorationStyle,
            overflowWrap: parentStyle.overflowWrap ?? mergedDefaults.overflowWrap,
            textIndent: parentStyle.textIndent ?? mergedDefaults.textIndent ?? 0,
            textTransform: parentStyle.textTransform ?? mergedDefaults.textTransform ?? "none",
            listStyleType: parentStyle.listStyleType ?? mergedDefaults.listStyleType ?? "disc",
        };
    }
}
