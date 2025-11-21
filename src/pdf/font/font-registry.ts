import type { CSSFontFace, Run, StyleSheets } from "../types.js";
import { PdfDocument, type PdfObjectRef } from "../primitives/pdf-document.js";
import type { FontConfig, TtfFontMetrics } from "../../types/fonts.js";
import { computeWidths, FontEmbedder } from "./embedder.js";
import { log } from "../../debug/log.js";
import { needsUnicode } from "../../text/text.js";
import { fontWeightCacheKey, normalizeFontWeight, isBoldFontWeight, parseFontWeightValue } from "../../css/font-weight.js";
import { PdfFontRegistry as GlyphSubsetRegistry } from "../font-subset/font-registry.js";
import type { PdfFontSubset } from "./font-subset.js";
import type { GlyphRun } from "../../layout/text-run.js";
import type { UnifiedFont } from "../../fonts/types.js";
import type { EmbeddedFont } from "./embedder.js";

const DEFAULT_STEM_V = 80;

export type PdfFont = {
  name: string;
  baseName?: string;    // for Base14 (Helvetica, etc.)
  isBase14: boolean;
  // ... extend as needed
};

export function getBase14(family: "Helvetica" | "Times-Roman" | "Courier"): PdfFont {
  return { isBase14: true, baseName: family, name: family };
}

// Note: getFontForText needs access to doc and config, so we'll modify the signature
export function getFontForText(_requestedFamily: string, text: string, _doc: any, _config: any): PdfFont {
  if (needsUnicode(text)) {
    // For now, use a simplified approach - we'll assume NotoSans-Regular is available
    // In a full implementation, you'd initialize the embedder properly
    const fontName = "NotoSans-Regular";
    log("FONT", "INFO", "font-path", { base14: false, family: fontName, encoding: "Identity-H" });
    return { isBase14: false, name: fontName };
  }
  const f = getBase14("Helvetica"); // fallback
  log("FONT", "INFO", "font-path", { base14: true, family: f.baseName, encoding: "WinAnsi" });
  return f;
}

const DEFAULT_FONT = "Times New Roman"; // Use embedded TTF font instead of base14

export interface FontResource {
  readonly baseFont: string;
  readonly resourceName: string;
  readonly ref: PdfObjectRef;
  readonly isBase14: boolean;
  readonly metrics?: TtfFontMetrics;
  readonly embedded?: EmbeddedFont;
}

interface SubsetFontResource {
  readonly alias: string;
  readonly subset: PdfFontSubset;
  readonly ref: PdfObjectRef;
  readonly font: FontResource;
}

export class FontRegistry {
  private readonly fontsByFamilyWeight = new Map<string, FontResource>();
  private readonly fontsByBaseFont = new Map<string, FontResource>();
  private readonly facesByFamily = new Map<string, CSSFontFace[]>();
  private readonly glyphSubsetRegistry = new GlyphSubsetRegistry();
  private readonly subsetResources = new Map<string, SubsetFontResource>();
  private aliasCounter = 1;
  private embedder: FontEmbedder | null = null;
  private fontConfig: FontConfig | null = null;

  constructor(private readonly doc: PdfDocument, stylesheets: StyleSheets) {
    for (const face of stylesheets.fontFaces ?? []) {
      const family = normalizeToken(face.family);
      if (!family) {
        continue;
      }
      const list = this.facesByFamily.get(family) ?? [];
      list.push(face);
      this.facesByFamily.set(family, list);
    }
  }

  async ensureFontResource(family: string | undefined, weight?: number, style?: string): Promise<FontResource> {
    const normalizedWeight = normalizeFontWeight(weight);
    const familyKey = this.makeFamilyKey(family, normalizedWeight, style);
    const cached = this.fontsByFamilyWeight.get(familyKey);
    if (cached) {
      return cached;
    }

    if (this.embedder && this.fontConfig) {
      const familyStack = this.buildAliasedFamilyStack(family);
      const embedded = this.embedder.ensureFont(familyStack, normalizedWeight);
      if (embedded) {
        const resource: FontResource = {
          baseFont: embedded.baseFont,
          resourceName: embedded.resourceName,
          ref: embedded.ref,
          isBase14: false,
          metrics: embedded.metrics,
          embedded,
        };
        this.fontsByFamilyWeight.set(familyKey, resource);
        return resource;
      }
    }

    const resolved = this.ensureStandardFontResource(family, normalizedWeight, style);
    this.fontsByFamilyWeight.set(familyKey, resolved);
    return resolved;
  }

  // New method to get embedder reference
  getEmbedder(): FontEmbedder | null {
    return this.embedder;
  }

  getDefaultFontStack(): string[] {
    if (!this.fontConfig?.defaultStack || this.fontConfig.defaultStack.length === 0) {
      return [];
    }
    return [...this.fontConfig.defaultStack];
  }

  ensureFontResourceSync(family: string | undefined, weight?: number, style?: string): FontResource {
    const normalizedWeight = normalizeFontWeight(weight);
    const familyKey = this.makeFamilyKey(family, normalizedWeight, style);
    const cached = this.fontsByFamilyWeight.get(familyKey);
    if (cached) {
      return cached;
    }

    if (this.embedder && this.fontConfig) {
      const familyStack = this.buildAliasedFamilyStack(family);

      // Note: embedder.ensureFont is synchronous in its implementation (it uses pre-loaded data)
      // even though the interface might not explicitly say so, we know it returns EmbeddedFont | null immediately.
      const embedded = this.embedder.ensureFont(familyStack, normalizedWeight);
      if (embedded) {
        const resource: FontResource = {
          baseFont: embedded.baseFont,
          resourceName: embedded.resourceName,
          ref: embedded.ref,
          isBase14: false,
          metrics: embedded.metrics,
          embedded,
        };
        this.fontsByFamilyWeight.set(familyKey, resource);
        return resource;
      }
    }

    const resolved = this.ensureStandardFontResource(family, normalizedWeight, style);
    this.fontsByFamilyWeight.set(familyKey, resolved);
    return resolved;
  }

  ensureSubsetForGlyphRun(glyphRun: GlyphRun, font: FontResource): SubsetFontResource {
    this.glyphSubsetRegistry.registerGlyphRun(glyphRun);
    const handle = this.glyphSubsetRegistry.ensureSubsetFor(glyphRun.font as UnifiedFont);

    const baseAlias = handle.subset.name.startsWith("/") ? handle.subset.name.slice(1) : handle.subset.name;
    const alias = `GS${baseAlias}`;
    const existing = this.subsetResources.get(alias);
    if (existing) {
      return existing;
    }

    const subsetForUse: PdfFontSubset = { ...handle.subset, name: `/${alias}` };
    const ref = this.materializeSubsetFont(subsetForUse, font, handle.unifiedFont);
    const resource: SubsetFontResource = { alias, subset: subsetForUse, ref, font };
    this.subsetResources.set(alias, resource);
    return resource;
  }

  /**
   * Build a family stack enriched with aliases and generic fallbacks,
   * e.g. "Times New Roman" -> ["Times New Roman", "Tinos", "serif"] so the
   * embedder can find our built-in faces.
   */
  private buildAliasedFamilyStack(family: string | undefined): string[] {
    const baseStack = family ? parseFamilyList(family) : this.fontConfig?.defaultStack ?? [];
    return baseStack.flatMap((f) => {
      const normalized = normalizeToken(f);
      const alias = BASE_FONT_ALIASES.get(normalized);
      const generic = GENERIC_FAMILIES.get(normalized);
      return [f, alias, generic].filter((x): x is string => !!x);
    });
  }

  private ensureStandardFontResource(family: string | undefined, weight: number, style?: string): FontResource {
    const candidates = [...parseFamilyList(family), DEFAULT_FONT];
    for (const candidate of candidates) {
      const normalizedCandidate = normalizeToken(candidate);
      if (!normalizedCandidate) {
        continue;
      }
      const candidateKey = this.familyWeightKey(normalizedCandidate, weight, style);
      const existing = this.fontsByFamilyWeight.get(candidateKey);
      if (existing) {
        this.fontsByFamilyWeight.set(this.makeFamilyKey(family, weight, style), existing);
        return existing;
      }
      const baseFont = this.resolveBaseFont(normalizedCandidate, weight, style, this.embedder !== null);
      const resource = this.ensureBaseFontResource(baseFont);
      this.fontsByFamilyWeight.set(candidateKey, resource);
      this.fontsByFamilyWeight.set(this.makeFamilyKey(candidate, weight, style), resource);
      if (family && candidate !== family) {
        this.fontsByFamilyWeight.set(this.makeFamilyKey(family, weight, style), resource);
      }
      return resource;
    }
    const fallbackBase = this.applyWeightToBaseFont(DEFAULT_FONT, weight, style);
    const fallback = this.ensureBaseFontResource(fallbackBase);
    this.fontsByFamilyWeight.set(this.familyWeightKey("", weight, style), fallback);
    return fallback;
  }

  private resolveBaseFont(family: string, weight: number, style: string | undefined, allowEmbeddedAlias: boolean): string {
    const faces = this.facesByFamily.get(family);
    if (faces && faces.length > 0) {
      const selectedFace = selectFaceForWeight(faces, weight);
      if (selectedFace) {
        const base = baseFontFromFace(selectedFace);
        if (base) {
          return this.applyWeightToBaseFont(base, weight, style);
        }
      }
    }
    if (!allowEmbeddedAlias) {
      const base14Fallback = BASE14_FALLBACKS.get(family);
      if (base14Fallback) {
        return this.applyWeightToBaseFont(base14Fallback, weight, style);
      }
    }
    const alias = BASE_FONT_ALIASES.get(family);
    if (alias) {
      const isAliasBase14 = BASE14_VARIANT_LOOKUP.has(alias.toLowerCase());
      // When we can't embed fonts, avoid mapping to non-Base14 aliases (e.g. Tinos)
      if (allowEmbeddedAlias || isAliasBase14) {
        return this.applyWeightToBaseFont(alias, weight, style);
      }
    }
    const generic = GENERIC_FAMILIES.get(family);
    if (generic) {
      return this.applyWeightToBaseFont(generic, weight, style);
    }
    return this.applyWeightToBaseFont(DEFAULT_FONT, weight, style);
  }

  private makeFamilyKey(family: string | undefined, weight: number, style?: string): string {
    return this.familyWeightKey(normalizeToken(family), weight, style);
  }

  private familyWeightKey(normalizedFamily: string, weight: number, style?: string): string {
    const familyToken = normalizedFamily && normalizedFamily.length > 0 ? normalizedFamily : "__default";
    const styleToken = isItalicStyle(style) ? "_italic" : "";
    return `${familyToken}@${fontWeightCacheKey(weight)}${styleToken}`;
  }

  private applyWeightToBaseFont(baseFont: string, weight: number, style?: string): string {
    const wantsItalic = isItalicStyle(style);
    const wantsBold = isBoldFontWeight(weight);

    const base14Family = detectBase14Family(baseFont);
    if (base14Family) {
      const variants = BASE14_FAMILY_VARIANTS[base14Family];
      const currentVariant = classifyBase14Variant(baseFont);
      const targetVariant: Base14Variant =
        wantsBold && wantsItalic ? "boldItalic"
          : wantsBold ? "bold"
            : wantsItalic ? "italic"
              : "normal";

      if (currentVariant === targetVariant) {
        return baseFont;
      }
      return variants[targetVariant];
    }

    let result = baseFont;

    if (wantsItalic && !/-italic$/i.test(result) && !/-oblique$/i.test(result)) {
      result = `${result}-Italic`;
    }

    if (wantsBold && !/-bold$/i.test(result)) {
      if (/-italic$/i.test(result)) {
        result = result.replace(/-italic$/i, "");
      } else if (/-oblique$/i.test(result)) {
        result = result.replace(/-oblique$/i, "");
      }

      return wantsItalic ? `${result}-BoldItalic` : `${result}-Bold`;
    }

    return result;
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

  private ensureBaseFontResource(baseFont: string): FontResource {
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

  async initializeEmbedder(fontConfig: FontConfig): Promise<void> {
    this.fontConfig = fontConfig;
    this.embedder = new FontEmbedder(fontConfig, this.doc);
    await this.embedder.initialize();
    log("FONT", "DEBUG", "embedder initialized", { fontConfig });
  }

  setFontConfig(fontConfig: FontConfig): void {
    this.fontConfig = fontConfig;
    this.embedder = new FontEmbedder(fontConfig, this.doc);
    log("FONT", "DEBUG", "font config set", { fontConfig });
  }
}

export function initFontSystem(doc: PdfDocument, stylesheets: StyleSheets): FontRegistry {
  return new FontRegistry(doc, stylesheets);
}

export async function ensureFontSubset(registry: FontRegistry, run: Run): Promise<FontResource> {
  const font = await registry.ensureFontResource(run.fontFamily, run.fontWeight, run.fontStyle);
  // === diagnóstico cirúrgico: caminho de fonte ===
  log("FONT", "INFO", "font-path", {
    base14: font.isBase14 === true,
    family: font.baseFont,
    encoding: font.isBase14 ? "WinAnsi" : "Identity-H"
  });
  return font;
}

export function ensureFontSubsetSync(registry: FontRegistry, run: Run): FontResource {
  const font = registry.ensureFontResourceSync(run.fontFamily, run.fontWeight, run.fontStyle);
  // === diagnóstico cirúrgico: caminho de fonte ===
  log("FONT", "INFO", "font-path", {
    base14: font.isBase14 === true,
    family: font.baseFont,
    encoding: font.isBase14 ? "WinAnsi" : "Identity-H"
  });
  return font;
}

export function finalizeFontSubsets(_registry: FontRegistry): void {
  // Actual font materialization happens during PdfDocument.finalize().
}

export function preflightFontsForPdfa(_registry: FontRegistry): void {
  // Placeholder for PDF/A validations.
}

const BASE_FONT_ALIASES = new Map<string, string>([
  ["helvetica", "Arimo"],            // Use Arimo instead of Helvetica
  ["arial", "Arimo"],                // Use Arimo instead of Helvetica
  ["times", "Tinos"],                // Use Tinos instead of Times-Roman
  ["times-roman", "Tinos"],          // Use Tinos instead of Times-Roman
  ["times new roman", "Tinos"],      // Use Tinos instead of Times-Roman
  ["georgia", "Tinos"],              // Use Tinos instead of Times-Roman
  ["courier", "DejaVu Sans"],         // Use DejaVu instead of Courier
  ["courier new", "DejaVu Sans"],     // Use DejaVu instead of Courier
  ["monaco", "DejaVu Sans"],          // Use DejaVu instead of Courier
  ["symbol", "Symbol"],
  ["zapfdingbats", "ZapfDingbats"],
  ["notosans-regular", "NotoSans-Regular"],  // Unicode-capable font for bullets
  ["roboto", "Roboto-Regular"],              // Map generic Roboto to specific variant
]);

const GENERIC_FAMILIES = new Map<string, string>([
  ["serif", "Tinos"],            // Use Tinos instead of Times-Roman
  ["sans-serif", "Arimo"],       // Use Arimo instead of Helvetica
  ["monospace", "DejaVu Sans"],   // Use DejaVu instead of Courier
  ["system-ui", "Arimo"],        // Use Arimo instead of Helvetica
  ["cursive", "Tinos"],           // Use Tinos instead of Times-Roman
  ["fantasy", "Arimo"],          // Use Arimo instead of Helvetica
]);

const BASE14_FAMILY_VARIANTS = {
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

type Base14Family = keyof typeof BASE14_FAMILY_VARIANTS;
type Base14Variant = "normal" | "italic" | "bold" | "boldItalic";

const BASE14_VARIANT_LOOKUP = new Map<string, { family: Base14Family; variant: Base14Variant }>();
for (const [family, variants] of Object.entries(BASE14_FAMILY_VARIANTS) as Array<[Base14Family, Record<Base14Variant, string>]>) {
  for (const [variant, name] of Object.entries(variants) as Array<[Base14Variant, string]>) {
    BASE14_VARIANT_LOOKUP.set(name.toLowerCase(), { family, variant });
  }
}

const BASE14_FALLBACKS = new Map<string, string>([
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

function parseFamilyList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((token) => stripQuotes(token.trim()))
    .filter((token) => token.length > 0);
}

function isItalicStyle(style: string | undefined): boolean {
  if (!style) {
    return false;
  }
  const normalized = style.toLowerCase();
  return normalized === "italic" || normalized === "oblique";
}

function detectBase14Family(baseFont: string): Base14Family | null {
  const entry = BASE14_VARIANT_LOOKUP.get(baseFont.toLowerCase());
  return entry ? entry.family : null;
}

function classifyBase14Variant(baseFont: string): Base14Variant {
  const entry = BASE14_VARIANT_LOOKUP.get(baseFont.toLowerCase());
  return entry ? entry.variant : "normal";
}

function normalizeToken(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return stripQuotes(value).trim().toLowerCase();
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function baseFontFromFace(face: CSSFontFace): string | null {
  const localName = extractLocalSource(face.src);
  if (localName) {
    const normalized = normalizeToken(localName);
    const alias = BASE_FONT_ALIASES.get(normalized);
    if (alias) {
      return alias;
    }
  }
  const familyAlias = BASE_FONT_ALIASES.get(normalizeToken(face.family));
  if (familyAlias) {
    return familyAlias;
  }
  return null;
}

function extractLocalSource(srcList: string[]): string | null {
  for (const src of srcList) {
    const match = src.match(/local\(([^)]+)\)/i);
    if (match) {
      return stripQuotes(match[1].trim());
    }
  }
  return null;
}

function selectFaceForWeight(faces: CSSFontFace[], requestedWeight: number): CSSFontFace | undefined {
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
