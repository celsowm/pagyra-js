/**
 * Manages font subsets and their materialization into PDF objects.
 * 
 * This manager is responsible for:
 * 1. Tracking glyph usage via GlyphSubsetRegistry.
 * 2. Creating and caching SubsetFontResources.
 * 3. Materializing font subsets (generating FontDescriptor, CIDFont, Type0 dictionaries).
 * 4. Computing PDF font flags.
 */

import { PdfDocument, type PdfObjectRef } from "../../primitives/pdf-document.js";
import { PdfFontRegistry as GlyphSubsetRegistry } from "../../font-subset/font-registry.js";
import type { PdfFontSubset } from "../font-subset.js";
import type { GlyphRun } from "../../../layout/text-run.js";
import type { UnifiedFont } from "../../../fonts/types.js";
import type { TtfFontMetrics } from "../../../types/fonts.js";
import type { FontResource } from "../font-registry.js";
import { computeWidths } from "../widths.js";
import { log } from "../../../debug/log.js";

const DEFAULT_STEM_V = 80;

export interface SubsetFontResource {
    readonly alias: string;
    readonly subset: PdfFontSubset;
    readonly ref: PdfObjectRef;
    readonly font: FontResource;
}

export class SubsetResourceManager {
    private readonly glyphSubsetRegistry = new GlyphSubsetRegistry();
    private readonly subsetResources = new Map<string, SubsetFontResource>();

    constructor(private readonly doc: PdfDocument) { }

    registerGlyphRun(glyphRun: GlyphRun): void {
        this.glyphSubsetRegistry.registerGlyphRun(glyphRun);
    }

    ensureSubsetForGlyphRun(glyphRun: GlyphRun, font: FontResource): SubsetFontResource {
        this.registerGlyphRun(glyphRun);
        const handle = this.glyphSubsetRegistry.ensureSubsetFor(glyphRun.font as UnifiedFont);

        const baseAlias = handle.subset.name.startsWith("/") ? handle.subset.name.slice(1) : handle.subset.name;
        const alias = `GS${baseAlias}`;
        const existing = this.subsetResources.get(alias);
        const subsetForUse: PdfFontSubset = { ...handle.subset, name: `/${alias}` };

        if (existing && this.subsetMatches(existing.subset, subsetForUse)) {
            return existing;
        }

        const ref = this.materializeSubsetFont(subsetForUse, font, handle.unifiedFont);
        const resource: SubsetFontResource = { alias, subset: subsetForUse, ref, font };
        this.subsetResources.set(alias, resource);
        return resource;
    }

    private subsetMatches(current: PdfFontSubset, next: PdfFontSubset): boolean {
        if (current.glyphIds.length !== next.glyphIds.length) {
            return false;
        }
        for (let i = 0; i < current.glyphIds.length; i++) {
            if (current.glyphIds[i] !== next.glyphIds[i]) {
                return false;
            }
        }
        return true;
    }

    private materializeSubsetFont(subset: PdfFontSubset, font: FontResource, unifiedFont: UnifiedFont): PdfObjectRef {
        const metrics = font.metrics ?? (unifiedFont.metrics as unknown as TtfFontMetrics | undefined);
        if (!metrics) {
            return font.ref;
        }

        const unitsPerEm = metrics.metrics.unitsPerEm;
        const scaleTo1000 = (v: number) => Math.round((v / unitsPerEm) * 1000);
        const fontBBox: [number, number, number, number] = metrics.headBBox
            ? [
                scaleTo1000(metrics.headBBox[0]),
                scaleTo1000(metrics.headBBox[1]),
                scaleTo1000(metrics.headBBox[2]),
                scaleTo1000(metrics.headBBox[3]),
            ]
            : [-1000, -1000, 1000, 1000];

        const fontFile = font.embedded?.subset ?? subset.fontFile;
        if (!fontFile || fontFile.length === 0) {
            log("FONT", "WARN", "missing-font-file-for-subset", { baseFont: font.baseFont, alias: subset.name });
            return font.ref;
        }

        const { DW, W } = computeWidths(metrics);
        const subsetTag = subset.name.startsWith("/") ? subset.name.slice(1) : subset.name;
        const subsetBaseName = `${subsetTag}+${font.baseFont}`;

        const fontFileRef = this.doc.registerStream(fontFile, {});
        const fontDescriptor = {
            Type: "/FontDescriptor",
            FontName: `/${subsetBaseName}`,
            Flags: this.computePdfFlags(font, unifiedFont),
            FontBBox: fontBBox,
            ItalicAngle: unifiedFont.css?.style === "italic" ? -12 : 0,
            Ascent: scaleTo1000(metrics.metrics.ascender),
            Descent: scaleTo1000(metrics.metrics.descender),
            CapHeight: scaleTo1000(metrics.metrics.capHeight ?? metrics.metrics.ascender),
            XHeight: scaleTo1000(metrics.metrics.xHeight ?? metrics.metrics.ascender / 2),
            StemV: DEFAULT_STEM_V,
            FontFile2: fontFileRef,
        };
        const fontDescriptorRef = this.doc.register(fontDescriptor);

        const cidFontDict = {
            Type: "/Font",
            Subtype: "/CIDFontType2",
            BaseFont: `/${subsetBaseName}`,
            CIDSystemInfo: {
                Registry: "(Adobe)",
                Ordering: "(Identity)",
                Supplement: 0,
            },
            FontDescriptor: fontDescriptorRef,
            DW,
            W,
            CIDToGIDMap: "/Identity",
        };
        const cidFontRef = this.doc.register(cidFontDict);

        const toUnicodeRef = this.doc.registerStream(new TextEncoder().encode(subset.toUnicodeCMap), {});
        const type0Font = {
            Type: "/Font",
            Subtype: "/Type0",
            BaseFont: `/${subsetBaseName}-Identity-H`,
            Encoding: "/Identity-H",
            DescendantFonts: [cidFontRef],
            ToUnicode: toUnicodeRef,
        };

        return this.doc.register(type0Font);
    }

    private computePdfFlags(font: FontResource, unifiedFont: UnifiedFont): number {
        const family = unifiedFont.css?.family?.toLowerCase() ?? font.baseFont.toLowerCase();
        const style = unifiedFont.css?.style ?? "";
        const isItalic = /italic|oblique/i.test(style) || /italic|oblique/i.test(font.baseFont);
        const isSerif = family.includes("serif");
        const isSymbol = family.includes("symbol") || family.includes("dingbat") || font.baseFont.toLowerCase().includes("symbol");

        let flags = 0;
        if (isSymbol) {
            flags |= 1 << 2;
        } else {
            flags |= 1 << 5;
        }
        if (isSerif) {
            flags |= 1 << 1;
        }
        if (isItalic) {
            flags |= 1 << 6;
        }
        return flags;
    }
}
