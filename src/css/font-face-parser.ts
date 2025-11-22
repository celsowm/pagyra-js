/**
 * CSS @font-face parsing utilities.
 * 
 * This module handles parsing of CSS @font-face rules from stylesheets,
 * including font family list parsing, weight matching, and source extraction.
 */

import type { CSSFontFace, StyleSheets } from "../pdf/types.js";
import { normalizeFontWeight, parseFontWeightValue } from "./font-weight.js";

/**
 * Result of parsing font faces from stylesheets.
 */
export interface ParsedFontFaceMap {
    /**
     * Map of normalized font family names to their @font-face definitions.
     */
    facesByFamily: Map<string, CSSFontFace[]>;
}

/**
 * Parse all @font-face definitions from stylesheets into a family-keyed map.
 * 
 * @param stylesheets - StyleSheets containing font face definitions
 * @returns Map of font families to their face definitions
 * 
 * @example
 * ```typescript
 * const { facesByFamily } = parseFontFaces(stylesheets);
 * const tinosFaces = facesByFamily.get("tinos");
 * ```
 */
export function parseFontFaces(stylesheets: StyleSheets): ParsedFontFaceMap {
    const facesByFamily = new Map<string, CSSFontFace[]>();

    for (const face of stylesheets.fontFaces ?? []) {
        const family = normalizeToken(face.family);
        if (!family) {
            continue;
        }
        const list = facesByFamily.get(family) ?? [];
        list.push(face);
        facesByFamily.set(family, list);
    }

    return { facesByFamily };
}

/**
 * Select the best @font-face from a list based on requested weight.
 * 
 * Chooses the face with the smallest weight difference from the requested weight.
 * Falls back to the first face if no weight information is available.
 * 
 * @param faces - Array of font faces to select from
 * @param requestedWeight - Desired font weight (100-900)
 * @returns Best matching font face, or undefined if faces array is empty
 */
export function selectFaceForWeight(faces: CSSFontFace[], requestedWeight: number): CSSFontFace | undefined {
    let bestFace: CSSFontFace | undefined;
    let smallestDiff = Number.POSITIVE_INFINITY;

    for (const face of faces) {
        const faceWeight = parseFaceWeight(face.weight, requestedWeight);
        if (faceWeight === null) {
            if (!bestFace) {
                bestFace = face;
            }
            continue;
        }
        const diff = Math.abs(faceWeight - requestedWeight);
        if (diff < smallestDiff) {
            smallestDiff = diff;
            bestFace = face;
        }
    }

    return bestFace ?? faces[0];
}

/**
 * Parse a font family list (comma-separated) into individual family names.
 * 
 * Handles quoted family names and filters out empty tokens.
 * 
 * @param value - Comma-separated font family string
 * @returns Array of normalized family names
 * 
 * @example
 * ```typescript
 * parseFamilyList("'Times New Roman', Times, serif")
 * // => ["Times New Roman", "Times", "serif"]
 * ```
 */
export function parseFamilyList(value: string | undefined): string[] {
    if (!value) {
        return [];
    }
    return value
        .split(",")
        .map((token) => stripQuotes(token.trim()))
        .filter((token) => token.length > 0);
}

/**
 * Check if a font style is italic or oblique.
 * 
 * @param style - Font style value
 * @returns True if style is "italic" or "oblique" (case-insensitive)
 */
export function isItalicStyle(style: string | undefined): boolean {
    if (!style) {
        return false;
    }
    const normalized = style.toLowerCase();
    return normalized === "italic" || normalized === "oblique";
}

/**
 * Normalize a font family or token to lowercase and remove quotes.
 * 
 * @param value - Token to normalize
 * @returns Normalized lowercase string, or empty string if value is undefined
 */
export function normalizeToken(value: string | undefined): string {
    if (!value) {
        return "";
    }
    return stripQuotes(value).trim().toLowerCase();
}

/**
 * Remove surrounding quotes from a string.
 * 
 * Handles both single and double quotes.
 * 
 * @param value - String potentially wrapped in quotes
 * @returns String with quotes removed, or original value if not quoted
 */
export function stripQuotes(value: string): string {
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    return value;
}

/**
 * Extract base font name from a @font-face definition using aliases.
 * 
 * Checks both local() sources and the family name against the provided alias map.
 * 
 * @param face - @font-face definition
 * @param aliases - Map of font names to their aliases
 * @returns Base font name if found, null otherwise
 */
export function baseFontFromFace(face: CSSFontFace, aliases: ReadonlyMap<string, string>): string | null {
    const localName = extractLocalSource(face.src);
    if (localName) {
        const normalized = normalizeToken(localName);
        const alias = aliases.get(normalized);
        if (alias) {
            return alias;
        }
    }
    const familyAlias = aliases.get(normalizeToken(face.family));
    if (familyAlias) {
        return familyAlias;
    }
    return null;
}

/**
 * Extract the first local() font source from a src list.
 * 
 * @param srcList - Array of font source strings (e.g., ["local('Arial')", "url(...))"])
 * @returns Local font name if found, null otherwise
 * 
 * @example
 * ```typescript
 * extractLocalSource(["local('Arial')", "url(arial.woff2)"])
 * // => "Arial"
 * ```
 */
export function extractLocalSource(srcList: string[]): string | null {
    for (const src of srcList) {
        const match = src.match(/local\(([^)]+)\)/i);
        if (match) {
            return stripQuotes(match[1].trim());
        }
    }
    return null;
}

/**
 * Parse a @font-face weight value into a numeric weight.
 * 
 * Handles:
 * - Numeric weights (already normalized)
 * - String values ("normal", "bold", "400", etc.)
 * - Multiple weights (chooses closest to fallback)
 * 
 * @param value - Weight value from @font-face
 * @param fallback - Fallback weight to use for choosing from multiple values
 * @returns Normalized numeric weight (100-900), or null if unparseable
 */
function parseFaceWeight(value: string | number | undefined, fallback: number): number | null {
    if (typeof value === "number") {
        return normalizeFontWeight(value);
    }
    if (typeof value !== "string") {
        return null;
    }
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
        const parsedWeights = parts
            .map((part) => parseFontWeightValue(part, fallback))
            .filter((weight): weight is number => weight !== undefined)
            .map((weight) => normalizeFontWeight(weight));
        if (parsedWeights.length === 0) {
            return null;
        }
        return parsedWeights.reduce((closest, candidate) => {
            const candidateDiff = Math.abs(candidate - fallback);
            const closestDiff = Math.abs(closest - fallback);
            return candidateDiff < closestDiff ? candidate : closest;
        }, parsedWeights[0]);
    }
    const parsed = parseFontWeightValue(value, fallback);
    if (parsed === undefined) {
        return null;
    }
    return normalizeFontWeight(parsed);
}
