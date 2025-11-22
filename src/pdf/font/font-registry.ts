import type { CSSFontFace, Run, StyleSheets } from "../types.js";
import { PdfDocument, type PdfObjectRef } from "../primitives/pdf-document.js";
import type { FontConfig, TtfFontMetrics } from "../../types/fonts.js";
import { FontEmbedder } from "./embedder.js";
import { computeWidths } from "./widths.js";
import { log } from "../../debug/log.js";
import { needsUnicode } from "../../text/text.js";
import { fontWeightCacheKey, normalizeFontWeight, isBoldFontWeight } from "../../css/font-weight.js";
import { PdfFontRegistry as GlyphSubsetRegistry } from "../font-subset/font-registry.js";
import type { PdfFontSubset } from "./font-subset.js";
import type { GlyphRun } from "../../layout/text-run.js";
import type { UnifiedFont } from "../../fonts/types.js";
import type { EmbeddedFont } from "./embedder.js";
import {
  parseFontFaces,
  selectFaceForWeight,
  parseFamilyList,
  isItalicStyle,
  normalizeToken,
  baseFontFromFace,
} from "../../css/font-face-parser.js";
import {
  BASE_FONT_ALIASES,
  GENERIC_FAMILIES,
  BASE14_FALLBACKS,
  BASE14_FAMILY_VARIANTS,
  BASE14_VARIANT_LOOKUP,
  detectBase14Family,
  classifyBase14Variant,
  type Base14Family,
  type Base14Variant,
} from "./font-config.js";
import { applyWeightToBaseFont } from "./resolvers/weight-style-applicator.js";
import { buildAliasedFamilyStack } from "./resolvers/family-resolver.js";
import { resolveBaseFont } from "./resolvers/base-font-mapper.js";
import { FontResourceManager } from "./managers/font-resource-manager.js";
import { SubsetResourceManager, type SubsetFontResource } from "./managers/subset-resource-manager.js";

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



export class FontRegistry {
  private readonly facesByFamily = new Map<string, CSSFontFace[]>();
  private readonly fontResourceManager: FontResourceManager;
  private readonly subsetResourceManager: SubsetResourceManager;
  private embedder: FontEmbedder | null = null;
  private fontConfig: FontConfig | null = null;

  constructor(private readonly doc: PdfDocument, stylesheets: StyleSheets) {
    const { facesByFamily } = parseFontFaces(stylesheets);
    this.facesByFamily = facesByFamily;
    this.fontResourceManager = new FontResourceManager(doc);
    this.subsetResourceManager = new SubsetResourceManager(doc);
  }

  async ensureFontResource(family: string | undefined, weight?: number, style?: string): Promise<FontResource> {
    const normalizedWeight = normalizeFontWeight(weight);
    const familyKey = this.makeFamilyKey(family, normalizedWeight, style);
    const cached = this.fontResourceManager.getCached(familyKey);
    if (cached) {
      return cached;
    }

    if (this.embedder && this.fontConfig) {
      const familyStack = buildAliasedFamilyStack(family, this.fontConfig?.defaultStack);
      const embedded = this.embedder.ensureFont(familyStack, normalizedWeight, style);
      if (embedded) {
        const resource: FontResource = {
          baseFont: embedded.baseFont,
          resourceName: embedded.resourceName,
          ref: embedded.ref,
          isBase14: false,
          metrics: embedded.metrics,
          embedded,
        };
        this.fontResourceManager.setCached(familyKey, resource);
        return resource;
      }
    }

    const resolved = this.ensureStandardFontResource(family, normalizedWeight, style);
    this.fontResourceManager.setCached(familyKey, resolved);
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
    const cached = this.fontResourceManager.getCached(familyKey);
    if (cached) {
      return cached;
    }

    if (this.embedder && this.fontConfig) {
      const familyStack = buildAliasedFamilyStack(family, this.fontConfig?.defaultStack);

      // Note: embedder.ensureFont is synchronous in its implementation (it uses pre-loaded data)
      // even though the interface might not explicitly say so, we know it returns EmbeddedFont | null immediately.
      const embedded = this.embedder.ensureFont(familyStack, normalizedWeight, style);
      if (embedded) {
        const resource: FontResource = {
          baseFont: embedded.baseFont,
          resourceName: embedded.resourceName,
          ref: embedded.ref,
          isBase14: false,
          metrics: embedded.metrics,
          embedded,
        };
        this.fontResourceManager.setCached(familyKey, resource);
        return resource;
      }
    }

    const resolved = this.ensureStandardFontResource(family, normalizedWeight, style);
    this.fontResourceManager.setCached(familyKey, resolved);
    return resolved;
  }

  ensureSubsetForGlyphRun(glyphRun: GlyphRun, font: FontResource): SubsetFontResource {
    return this.subsetResourceManager.ensureSubsetForGlyphRun(glyphRun, font);
  }



  private ensureStandardFontResource(family: string | undefined, weight: number, style?: string): FontResource {
    const candidates = [...parseFamilyList(family), DEFAULT_FONT];
    for (const candidate of candidates) {
      const normalizedCandidate = normalizeToken(candidate);
      if (!normalizedCandidate) {
        continue;
      }
      const candidateKey = this.familyWeightKey(normalizedCandidate, weight, style);
      const existing = this.fontResourceManager.getCached(candidateKey);
      if (existing) {
        this.fontResourceManager.setCached(this.makeFamilyKey(family, weight, style), existing);
        return existing;
      }
      const baseFont = resolveBaseFont(normalizedCandidate, weight, style, this.embedder !== null, this.facesByFamily);
      const resource = this.fontResourceManager.ensureBaseFontResource(baseFont);
      this.fontResourceManager.setCached(candidateKey, resource);
      this.fontResourceManager.setCached(this.makeFamilyKey(candidate, weight, style), resource);
      if (family && candidate !== family) {
        this.fontResourceManager.setCached(this.makeFamilyKey(family, weight, style), resource);
      }
      return resource;
    }
    const fallbackBase = applyWeightToBaseFont(DEFAULT_FONT, weight, style);
    const fallback = this.fontResourceManager.ensureBaseFontResource(fallbackBase);
    this.fontResourceManager.setCached(this.familyWeightKey("", weight, style), fallback);
    return fallback;
  }



  private makeFamilyKey(family: string | undefined, weight: number, style?: string): string {
    return this.familyWeightKey(normalizeToken(family), weight, style);
  }

  private familyWeightKey(normalizedFamily: string, weight: number, style?: string): string {
    const familyToken = normalizedFamily && normalizedFamily.length > 0 ? normalizedFamily : "__default";
    const styleToken = isItalicStyle(style) ? "_italic" : "";
    return `${familyToken}@${fontWeightCacheKey(weight)}${styleToken}`;
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
