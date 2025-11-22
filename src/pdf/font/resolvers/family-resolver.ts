/**
 * Logic for resolving font family stacks with aliases and fallbacks.
 * 
 * This module handles the expansion of font family names into a stack of candidates,
 * including aliases (e.g., "Arial" -> "Arimo") and generic families (e.g., "serif" -> "Tinos").
 */

import { parseFamilyList, normalizeToken } from "../../../css/font-face-parser.js";
import { BASE_FONT_ALIASES, GENERIC_FAMILIES } from "../font-config.js";

/**
 * Build a family stack enriched with aliases and generic fallbacks.
 * 
 * @param family - The requested font family string (comma-separated)
 * @param defaultStack - Default font stack to use if family is undefined/empty
 * @returns Array of font family names including aliases and generics
 * 
 * @example
 * ```typescript
 * buildAliasedFamilyStack("Times New Roman")
 * // => ["Times New Roman", "Tinos", "serif"]
 * ```
 */
export function buildAliasedFamilyStack(family: string | undefined, defaultStack: string[] = []): string[] {
    const baseStack = family ? parseFamilyList(family) : defaultStack;

    return baseStack.flatMap((f) => {
        const normalized = normalizeToken(f);
        const alias = BASE_FONT_ALIASES.get(normalized);
        const generic = GENERIC_FAMILIES.get(normalized);
        return [f, alias, generic].filter((x): x is string => !!x);
    });
}
