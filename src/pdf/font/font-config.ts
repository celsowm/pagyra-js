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
    ["helvetica", "Arimo"],            // Use Arimo instead of Helvetica
    ["arial", "Arimo"],                // Use Arimo instead of Helvetica
    ["times", "Tinos"],                // Use Tinos instead of Times-Roman
    ["times-roman", "Tinos"],          // Use Tinos instead of Times-Roman
    ["times new roman", "Tinos"],      // Use Tinos instead of Times-Roman
    ["georgia", "Tinos"],              // Use Tinos instead of Times-Roman
    ["courier", "DejaVu Sans"],        // Use DejaVu instead of Courier
    ["courier new", "DejaVu Sans"],    // Use DejaVu instead of Courier
    ["monaco", "DejaVu Sans"],         // Use DejaVu instead of Courier
    ["symbol", "Symbol"],
    ["zapfdingbats", "ZapfDingbats"],
    ["notosans-regular", "NotoSans-Regular"],  // Unicode-capable font for bullets
    ["roboto", "Roboto-Regular"],              // Map generic Roboto to specific variant
]);

/**
 * Maps CSS generic font families to specific embedded fonts.
 * 
 * Used when no specific font family is requested or as a final fallback.
 */
export const GENERIC_FAMILIES: ReadonlyMap<string, string> = new Map([
    ["serif", "Tinos"],            // Use Tinos instead of Times-Roman
    ["sans-serif", "Arimo"],       // Use Arimo instead of Helvetica
    ["monospace", "DejaVu Sans"],  // Use DejaVu instead of Courier
    ["system-ui", "Arimo"],        // Use Arimo instead of Helvetica
    ["cursive", "Tinos"],          // Use Tinos instead of Times-Roman
    ["fantasy", "Arimo"],          // Use Arimo instead of Helvetica
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
    ["serif", "Times-Roman"],
    ["helvetica", "Helvetica"],
    ["arial", "Helvetica"],
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
