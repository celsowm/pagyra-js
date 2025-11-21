import type { UnifiedFont } from "../../fonts/types.js";
import type { GlyphRun } from "../../layout/text-run.js";
import { createPdfFontSubset, type PdfFontSubset } from "../font/font-subset.js";

/**
 * Combines a PDF font subset with its source UnifiedFont.
 */
export interface PdfFontHandle {
    subset: PdfFontSubset;
    unifiedFont: UnifiedFont;
}

/**
 * Manages font subsets for PDF generation.
 * Collects glyph usage across the document and creates font subsets on demand.
 */
export class PdfFontRegistry {
    // Map from font key to set of used glyph IDs
    private readonly glyphUsage = new Map<string, Set<number>>();

    // Map from font key to PdfFontHandle (lazily created)
    private readonly fonts = new Map<string, PdfFontHandle>();

    // Counter for generating unique font resource names
    private fontCounter = 0;

    constructor(private readonly encoding: "identity" | "sequential" = "identity") {}

    /**
     * Generates a stable key for a UnifiedFont.
     * Uses CSS metadata if available, otherwise falls back to a generic key.
     */
    private fontKey(font: UnifiedFont): string {
        if (font.css) {
            const { family, weight, style } = font.css;
            return `${family}|${weight}|${style}`;
        }

        // Fallback: use unitsPerEm and ascender as a fingerprint
        const { unitsPerEm, ascender } = font.metrics.metrics;
        return `_fallback_${unitsPerEm}_${ascender}`;
    }

    /**
     * Registers a GlyphRun, collecting its glyph IDs for later subsetting.
     */
    registerGlyphRun(run: GlyphRun): void {
        const key = this.fontKey(run.font);
        let usage = this.glyphUsage.get(key);

        if (!usage) {
            usage = new Set<number>();
            this.glyphUsage.set(key, usage);
        }

        // Add all glyph IDs from this run
        for (const gid of run.glyphIds) {
            usage.add(gid);
        }
    }

    /**
     * Ensures a font subset exists for the given UnifiedFont.
     * Creates the subset lazily if it doesn't exist yet.
     */
    ensureSubsetFor(font: UnifiedFont): PdfFontHandle {
        const key = this.fontKey(font);

        const existing = this.fonts.get(key);
        if (existing) {
            return existing;
        }

        // Get the collected glyph IDs for this font
        const usedGlyphIds = this.glyphUsage.get(key) ?? new Set([0]);

        // Create the subset
        const baseName = `F${++this.fontCounter}`;
        const subset = createPdfFontSubset({
            baseName,
            fontMetrics: font.metrics,
            fontProgram: font.program,
            usedGlyphIds,
            encoding: this.encoding,
        });

        const handle: PdfFontHandle = {
            subset,
            unifiedFont: font,
        };

        this.fonts.set(key, handle);
        return handle;
    }

    /**
     * Returns all font subsets created so far.
     */
    getAllSubsets(): Iterable<PdfFontHandle> {
        return this.fonts.values();
    }

    /**
     * Returns the total number of fonts registered.
     */
    getFontCount(): number {
        return this.fonts.size;
    }
}
