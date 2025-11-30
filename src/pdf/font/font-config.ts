/**
 * Font configuration and mapping data for PDF font resolution.
 * 
 * This module centralizes all font alias mappings, generic family mappings,
 * and Base14 font variant configurations used throughout the font registry system.
 */

/**
 * Base14 variant types supported by PDF standard fonts.
 */
export type Base14Variant = "normal" | "italic" | "bold" | "boldItalic";

/**
 * Base14 font family names.
 */
export type Base14Family = "Helvetica" | "Times-Roman" | "Courier";

/**
 * Variant configuration for a Base14 font family.
 */
export interface Base14Variants {
    normal: string;
    italic: string;
    bold: string;
    boldItalic: string;
}

/**
 * Maps common font family names to embedded font aliases.
 * 
 * This enables fallback to built-in fonts when requested fonts aren't available.
 * For example, "Arial" → "Arimo", "Times New Roman" → "Tinos"
 */
export const BASE_FONT_ALIASES: ReadonlyMap<string, string> = new Map([
    // Sans/UI families
    ["helvetica", "Lato"],
    ["arial", "Arimo"],
    ["arial black", "Arimo"],
    ["segoe ui", "Roboto"],
    ["open sans", "Lato"],
    ["calibri", "Roboto"],
    ["roboto", "Roboto"],
    ["arimo", "Arimo"],
    ["lato", "Lato"],
    ["noto sans", "Noto Sans"],
    ["notosans-regular", "Noto Sans"],
    ["dejavu sans", "DejaVu Sans"],

    // Serif
    ["times", "Tinos"],
    ["times-roman", "Tinos"],
    ["times new roman", "Tinos"],
    ["georgia", "Tinos"],
    ["garamond", "Tinos"],
    ["baskerville", "Tinos"],

    // Mono
    ["courier", "Fira Code"],
    ["courier new", "Fira Code"],
    ["consolas", "Fira Code"],
    ["menlo", "Fira Code"],
    ["monaco", "Fira Code"],
    ["source code pro", "Fira Code"],

    // Decorative / cursive
    ["comic sans", "Caveat"],
    ["comic sans ms", "Caveat"],
    ["fantasy", "Cinzel Decorative"],
    ["cursive", "Caveat"],

    // Emoji / math / symbols
    ["noto emoji", "Noto Emoji"],
    ["noto color emoji", "Noto Emoji"],
    ["segoe ui emoji", "Noto Emoji"],
    ["apple color emoji", "Noto Emoji"],
    ["twemoji", "Noto Emoji"],
    ["cambria math", "STIX Two Math"],
    ["stix two math", "STIX Two Math"],
    ["math", "STIX Two Math"],
    ["symbol", "Symbol"],
    ["zapfdingbats", "ZapfDingbats"],
]);

/**
 * Maps CSS generic font families to specific embedded fonts.
 * 
 * Used when no specific font family is requested or as a final fallback.
 */
export const GENERIC_FAMILIES: ReadonlyMap<string, string> = new Map([
    ["serif", "Tinos"],
    ["sans-serif", "Lato"],
    ["monospace", "Fira Code"],
    ["system-ui", "Roboto"],
    ["cursive", "Caveat"],
    ["fantasy", "Cinzel Decorative"],
    ["emoji", "Noto Emoji"],
    ["math", "STIX Two Math"],
]);

/**
 * Maps common font family names to Base14 standard font fallbacks.
 * 
 * Used when font embedding is disabled or not available.
 */
export const BASE14_FALLBACKS: ReadonlyMap<string, string> = new Map([
    ["times", "Times-Roman"],
    ["times-roman", "Times-Roman"],
    ["times new roman", "Times-Roman"],
    ["georgia", "Times-Roman"],
    ["garamond", "Times-Roman"],
    ["baskerville", "Times-Roman"],
    ["serif", "Times-Roman"],
    ["helvetica", "Helvetica"],
    ["arial", "Helvetica"],
    ["segoe ui", "Helvetica"],
    ["open sans", "Helvetica"],
    ["calibri", "Helvetica"],
    ["sans-serif", "Helvetica"],
    ["system-ui", "Helvetica"],
    ["courier", "Courier"],
    ["courier new", "Courier"],
    ["monospace", "Courier"],
]);

/**
 * Base14 font family variants mapping.
 * 
 * Defines the standard variant names for each Base14 font family.
 * Used to apply weight/style transformations to Base14 fonts.
 */
export const BASE14_FAMILY_VARIANTS: Record<Base14Family, Base14Variants> = {
    "Helvetica": {
        normal: "Helvetica",
        italic: "Helvetica-Oblique",
        bold: "Helvetica-Bold",
        boldItalic: "Helvetica-BoldOblique",
    },
    "Times-Roman": {
        normal: "Times-Roman",
        italic: "Times-Italic",
        bold: "Times-Bold",
        boldItalic: "Times-BoldItalic",
    },
    "Courier": {
        normal: "Courier",
        italic: "Courier-Oblique",
        bold: "Courier-Bold",
        boldItalic: "Courier-BoldOblique",
    },
} as const;

/**
 * Reverse lookup map: Base14 variant name → family + variant type.
 * 
 * Built automatically from BASE14_FAMILY_VARIANTS.
 * Used to detect which Base14 family a font belongs to.
 */
export const BASE14_VARIANT_LOOKUP: ReadonlyMap<string, { family: Base14Family; variant: Base14Variant }> = (() => {
    const lookup = new Map<string, { family: Base14Family; variant: Base14Variant }>();

    for (const [family, variants] of Object.entries(BASE14_FAMILY_VARIANTS) as Array<[Base14Family, Record<Base14Variant, string>]>) {
        for (const [variant, name] of Object.entries(variants) as Array<[Base14Variant, string]>) {
            lookup.set(name.toLowerCase(), { family, variant });
        }
    }

    return lookup;
})();

/**
 * Detect the Base14 family for a given font name.
 * 
 * @param baseFont - Font name to check
 * @returns Base14 family name if found, null otherwise
 */
export function detectBase14Family(baseFont: string): Base14Family | null {
    const entry = BASE14_VARIANT_LOOKUP.get(baseFont.toLowerCase());
    return entry ? entry.family : null;
}

/**
 * Classify the variant type of a Base14 font.
 * 
 * @param baseFont - Font name to check
 * @returns Variant type (normal, italic, bold, boldItalic)
 */
export function classifyBase14Variant(baseFont: string): Base14Variant {
    const entry = BASE14_VARIANT_LOOKUP.get(baseFont.toLowerCase());
    return entry ? entry.variant : "normal";
}
