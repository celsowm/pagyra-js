/**
 * Manages the lifecycle and caching of FontResource objects.
 * 
 * This manager is responsible for:
 * 1. Caching resolved FontResources by family/weight/style.
 * 2. Caching FontResources by base font name.
 * 3. Creating and registering standard (Base14) font resources with the PDF document.
 * 4. Generating unique resource names (aliases) for fonts.
 */

import { PdfDocument } from "../../primitives/pdf-document.js";
import type { FontResource } from "../font-registry.js";

export class FontResourceManager {
    private readonly fontsByFamilyWeight = new Map<string, FontResource>();
    private readonly fontsByBaseFont = new Map<string, FontResource>();
    private aliasCounter = 1;

    constructor(private readonly doc: PdfDocument) { }

    /**
     * Retrieve a cached FontResource by its unique key.
     */
    getCached(key: string): FontResource | undefined {
        return this.fontsByFamilyWeight.get(key);
    }

    /**
     * Cache a FontResource by its unique key.
     */
    setCached(key: string, resource: FontResource): void {
        this.fontsByFamilyWeight.set(key, resource);
    }

    /**
     * Ensure a FontResource exists for a given base font name.
     * 
     * If the resource already exists in the cache, it is returned.
     * Otherwise, a new standard font resource is registered with the PDF document.
     */
    ensureBaseFontResource(baseFont: string): FontResource {
        const existing = this.fontsByBaseFont.get(baseFont);
        if (existing) {
            return existing;
        }

        const ref = this.doc.registerStandardFont(baseFont);
        const alias = `F${this.aliasCounter++}`;

        const BASE14_FAMILIES = new Set([
            "Helvetica",
            "Helvetica-Bold",
            "Helvetica-Oblique",
            "Helvetica-BoldOblique",
            "Times-Roman",
            "Times-Bold",
            "Times-Italic",
            "Times-BoldItalic",
            "Courier",
            "Courier-Bold",
            "Courier-Oblique",
            "Courier-BoldOblique",
            "Symbol",
            "ZapfDingbats",
        ]);

        const isBase14 = BASE14_FAMILIES.has(baseFont);
        const resource: FontResource = { baseFont, resourceName: alias, ref, isBase14 };

        this.fontsByBaseFont.set(baseFont, resource);
        return resource;
    }
}
