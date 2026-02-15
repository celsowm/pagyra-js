import type { CSSFontFace, Run, StyleSheets } from "../types.js";
import { PdfDocument, type PdfObjectRef } from "../primitives/pdf-document.js";
import type { FontConfig, TtfFontMetrics } from "../../types/fonts.js";
import { FontEmbedder } from "./embedder.js";
import { log } from "../../logging/debug.js";
import { needsUnicode } from "../../text/text.js";
import { fontWeightCacheKey, normalizeFontWeight } from "../../css/font-weight.js";
import type { GlyphRun } from "../../layout/text-run.js";
import type { EmbeddedFont } from "./embedder.js";
import {
  parseFontFaces,
  parseFamilyList,
  isItalicStyle,
  normalizeToken,
} from "../../css/font-face-parser.js";
import { applyWeightToBaseFont } from "./resolvers/weight-style-applicator.js";
import { buildAliasedFamilyStack } from "./resolvers/family-resolver.js";
import { resolveBaseFont } from "./resolvers/base-font-mapper.js";
import { FontResourceManager } from "./managers/font-resource-manager.js";
import { SubsetResourceManager, type SubsetFontResource } from "./managers/subset-resource-manager.js";

export type PdfFont = {
  name: string;
  baseName?: string;    // for Base14 (Helvetica, etc.)
  isBase14: boolean;
};

export function getBase14(family: "Helvetica" | "Times-Roman" | "Courier"): PdfFont {
  return { isBase14: true, baseName: family, name: family };
}

export function getFontForText(_requestedFamily: string, text: string, _doc: PdfDocument, _config: FontConfig): PdfFont {
  if (needsUnicode(text)) {
    const fontName = "NotoSans-Regular";
    log("font", "info", "font-path", { base14: false, family: fontName, encoding: "Identity-H" });
    return { isBase14: false, name: fontName };
  }
  const f = getBase14("Helvetica");
  log("font", "info", "font-path", { base14: true, family: f.baseName, encoding: "WinAnsi" });
  return f;
}

const DEFAULT_FONT = "Times New Roman";

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
          get ref() { return embedded.ref; },
          isBase14: false,
          metrics: embedded.metrics,
          embedded,
        } as FontResource;
        this.fontResourceManager.setCached(familyKey, resource);
        return resource;
      }
    }

    const resolved = this.ensureStandardFontResource(family, normalizedWeight, style);
    this.fontResourceManager.setCached(familyKey, resolved);
    return resolved;
  }

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
      const embedded = this.embedder.ensureFont(familyStack, normalizedWeight, style);
      if (embedded) {
        const resource: FontResource = {
          baseFont: embedded.baseFont,
          resourceName: embedded.resourceName,
          get ref() { return embedded.ref; },
          isBase14: false,
          metrics: embedded.metrics,
          embedded,
        } as FontResource;
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
    log("font", "debug", "embedder initialized", { fontConfig });
  }

  setFontConfig(fontConfig: FontConfig): void {
    this.fontConfig = fontConfig;
    this.embedder = new FontEmbedder(fontConfig, this.doc);
    log("font", "debug", "font config set", { fontConfig });
  }
}

export function initFontSystem(doc: PdfDocument, stylesheets: StyleSheets): FontRegistry {
  return new FontRegistry(doc, stylesheets);
}

export async function ensureFontSubset(registry: FontRegistry, run: Run): Promise<FontResource> {
  const font = await registry.ensureFontResource(run.fontFamily, run.fontWeight, run.fontStyle);
  log("font", "info", "font-path", {
    base14: font.isBase14 === true,
    family: font.baseFont,
    encoding: font.isBase14 ? "WinAnsi" : "Identity-H"
  });
  return font;
}

export function ensureFontSubsetSync(registry: FontRegistry, run: Run): FontResource {
  const font = registry.ensureFontResourceSync(run.fontFamily, run.fontWeight, run.fontStyle);
  log("font", "info", "font-path", {
    base14: font.isBase14 === true,
    family: font.baseFont,
    encoding: font.isBase14 ? "WinAnsi" : "Identity-H"
  });
  return font;
}

export function finalizeFontSubsets(_registry: FontRegistry): void {
}

export function preflightFontsForPdfa(_registry: FontRegistry): void {
}
