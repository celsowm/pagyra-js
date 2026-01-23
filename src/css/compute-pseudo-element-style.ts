// src/css/compute-pseudo-element-style.ts

import { ComputedStyle } from "./style.js";
import type { StyleAccumulator } from "./style.js";
import type { UnitParsers } from "../units/units.js";
import type { ContentValue } from "./parsers/content-parser.js";

/**
 * Pseudo-element type
 */
export type PseudoElementType = "::before" | "::after";

/**
 * Parsed pseudo-element style information
 */
export interface PseudoElementStyle {
    type: PseudoElementType;
    content?: ContentValue[];
    display: "inline" | "block" | "none";
    position: "static" | "relative" | "absolute" | "fixed";
    width?: number;
    height?: number;
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: number;
    fontStyle?: string;
    textDecoration?: string;
    verticalAlign?: string;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
}

/**
 * Parse pseudo-element selector from CSS rule
 * Returns the pseudo-element type if this is a pseudo-element rule
 */
export function parsePseudoSelector(selector: string): PseudoElementType | null {
    const normalized = selector.trim().toLowerCase();
    if (normalized === "::before" || normalized === ":before") {
        return "::before";
    }
    if (normalized === "::after" || normalized === ":after") {
        return "::after";
    }
    return null;
}

/**
 * Extract pseudo-element rules from CSS rules
 * Returns a map of pseudo-element type to style declarations
 */
export function extractPseudoElementRules(
    rules: Array<{ selector: string; declarations: Map<string, string> }>
): Map<PseudoElementType, Map<string, string>> {
    const result = new Map<PseudoElementType, Map<string, string>>();

    for (const rule of rules) {
        const pseudoType = parsePseudoSelector(rule.selector);
        if (!pseudoType) continue;

        if (!result.has(pseudoType)) {
            result.set(pseudoType, new Map());
        }
        const existing = result.get(pseudoType)!;
        for (const [prop, value] of rule.declarations) {
            existing.set(prop, value);
        }
    }

    return result;
}

/**
 * Helper to convert LengthInput to number
 */
function lengthToPx(value: unknown, reference: number): number {
    if (typeof value === "number") return value;
    if (value && typeof value === "object") {
        const v = value as { kind: string; value: number; unit?: string };
        if (v.kind === "absolute" && v.unit === "px") return v.value;
        if (v.kind === "relative") {
            return v.unit === "em" ? v.value * reference : v.value * reference;
        }
    }
    return 0;
}

/**
 * Compute pseudo-element style from declarations
 */
export function computePseudoElementStyle(
    pseudoType: PseudoElementType,
    declarations: Map<string, string> | undefined,
    parentStyle: ComputedStyle,
    units: UnitParsers
): PseudoElementStyle {
    const accumulator: StyleAccumulator = {};
    
    // Parse declarations into accumulator
    if (declarations) {
        for (const [prop, value] of declarations) {
            const parser = getPropertyParser(prop);
            if (parser) {
                parser(value, accumulator, units);
            }
        }
    }

    // Determine display
    const hasContent = accumulator.content && accumulator.content.length > 0;
    const displayFromAccumulator = accumulator.display;
    const hasDisplayBlock = displayFromAccumulator === "block" || displayFromAccumulator === "flex" || displayFromAccumulator === "grid";
    
    // ::before and ::after are inline by default, but become block if they have block-level content
    const effectiveDisplay = hasContent || hasDisplayBlock
        ? (displayFromAccumulator === "block" || displayFromAccumulator === "flex" || displayFromAccumulator === "grid" ? "block" : "inline")
        : "none";

    const fontSize = (accumulator.fontSize as number) ?? parentStyle.fontSize;
    
    // Extract margin and padding values
    const marginTop = lengthToPx(accumulator.marginTop, fontSize);
    const marginBottom = lengthToPx(accumulator.marginBottom, fontSize);
    const marginLeft = lengthToPx(accumulator.marginLeft, fontSize);
    const marginRight = lengthToPx(accumulator.marginRight, fontSize);
    const paddingTop = lengthToPx(accumulator.paddingTop, fontSize);
    const paddingBottom = lengthToPx(accumulator.paddingBottom, fontSize);
    const paddingLeft = lengthToPx(accumulator.paddingLeft, fontSize);
    const paddingRight = lengthToPx(accumulator.paddingRight, fontSize);

    return {
        type: pseudoType,
        content: accumulator.content,
        display: effectiveDisplay,
        position: (accumulator.position as "static" | "relative" | "absolute" | "fixed") ?? "static",
        width: typeof accumulator.width === "number" ? accumulator.width : undefined,
        height: typeof accumulator.height === "number" ? accumulator.height : undefined,
        color: accumulator.color ?? parentStyle.color,
        fontSize,
        fontFamily: accumulator.fontFamily ?? parentStyle.fontFamily,
        fontWeight: accumulator.fontWeight ?? parentStyle.fontWeight,
        fontStyle: accumulator.fontStyle ?? parentStyle.fontStyle,
        verticalAlign: accumulator.verticalAlign as string | undefined,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        paddingTop,
        paddingBottom,
        paddingLeft,
        paddingRight,
    };
}

// Avoid circular imports by only accessing registry after parsers are registered
// This function should be called after registerAllPropertyParsers() has run
let registryAccessor: (() => Map<string, (value: string, target: StyleAccumulator, units: UnitParsers) => void>) | null = null;

export function setRegistryAccessor(accessor: () => Map<string, (value: string, target: StyleAccumulator, units: UnitParsers) => void>): void {
    registryAccessor = accessor;
}

function getPropertyParser(prop: string): ((value: string, target: StyleAccumulator, units: UnitParsers) => void) | undefined {
    if (registryAccessor) {
        const registry = registryAccessor();
        return registry.get(prop.toLowerCase());
    }
    // Fallback: try to get from module (may fail if circular dependency)
    return undefined;
}
