/**
 * Logic for mapping font families to base font names.
 * 
 * This module handles the resolution of a font family + weight + style to a specific
 * base font name (e.g., "Helvetica-Bold"). It considers:
 * 1. CSS @font-face definitions
 * 2. Base14 fallbacks
 * 3. Font aliases
 * 4. Generic families
 */

import type { CSSFontFace } from "../../types.js";
import {
    selectFaceForWeight,
    baseFontFromFace,
} from "../../../css/font-face-parser.js";
import {
    BASE_FONT_ALIASES,
    BASE14_FALLBACKS,
    BASE14_VARIANT_LOOKUP,
    GENERIC_FAMILIES,
} from "../font-config.js";
import { applyWeightToBaseFont } from "./weight-style-applicator.js";

const DEFAULT_FONT = "Times New Roman";

/**
 * Resolve a font family to a base font name.
 * 
 * @param family - The requested font family
 * @param weight - The requested font weight
 * @param style - The requested font style
 * @param allowEmbeddedAlias - Whether to allow mapping to embedded font aliases (e.g. Tinos)
 * @param facesByFamily - Map of available @font-face definitions
 * @returns The resolved base font name
 */
export function resolveBaseFont(
    family: string,
    weight: number,
    style: string | undefined,
    allowEmbeddedAlias: boolean,
    facesByFamily: Map<string, CSSFontFace[]>
): string {
    const faces = facesByFamily.get(family);
    if (faces && faces.length > 0) {
        const selectedFace = selectFaceForWeight(faces, weight);
        if (selectedFace) {
            const base = baseFontFromFace(selectedFace, BASE_FONT_ALIASES);
            if (base) {
                return applyWeightToBaseFont(base, weight, style);
            }
        }
    }

    if (!allowEmbeddedAlias) {
        const base14Fallback = BASE14_FALLBACKS.get(family);
        if (base14Fallback) {
            return applyWeightToBaseFont(base14Fallback, weight, style);
        }
    }

    const alias = BASE_FONT_ALIASES.get(family);
    if (alias) {
        const isAliasBase14 = BASE14_VARIANT_LOOKUP.has(alias.toLowerCase());
        // When we can't embed fonts, avoid mapping to non-Base14 aliases (e.g. Tinos)
        if (allowEmbeddedAlias || isAliasBase14) {
            return applyWeightToBaseFont(alias, weight, style);
        }
    }

    const generic = GENERIC_FAMILIES.get(family);
    if (generic) {
        return applyWeightToBaseFont(generic, weight, style);
    }

    return applyWeightToBaseFont(DEFAULT_FONT, weight, style);
}
