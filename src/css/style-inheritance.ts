import type { ComputedStyle } from "./style.js";
import { cloneLineHeight } from "./line-height.js";

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
        mergedDefaults: Partial<any>
    ): {
        color?: string;
        fontSize: number;
        lineHeight: any;
        fontFamily?: string;
        fontStyle?: string;
        fontVariant?: string;
        fontWeight?: number;
        letterSpacing?: number;
        textDecorationLine?: string;
        textDecorationColor?: string;
        textDecorationStyle?: string;
        overflowWrap?: string;
        textIndent: any; // Using any to match the flexible type system
        textTransform: string;
        listStyleType: string;
    } {
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
