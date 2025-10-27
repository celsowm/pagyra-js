import type { CSSFontFace, Run, StyleSheets } from "../types.js";
import { PdfDocument, type PdfObjectRef } from "../primitives/pdf-document.js";
import type { FontConfig } from "../../types/fonts.js";
import { FontEmbedder } from "./embedder.js";
import { log } from "../../debug/log.js";
import { needsUnicode } from "../../text/text.js";
import { fontWeightCacheKey, normalizeFontWeight, isBoldFontWeight, parseFontWeightValue } from "../../css/font-weight.js";

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
export function getFontForText(requestedFamily: string, text: string, doc: any, config: any): PdfFont {
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

const DEFAULT_FONT = "Helvetica";

export interface FontResource {
  readonly baseFont: string;
  readonly resourceName: string;
  readonly ref: PdfObjectRef;
  readonly isBase14: boolean;
}

export class FontRegistry {
  private readonly fontsByFamilyWeight = new Map<string, FontResource>();
  private readonly fontsByBaseFont = new Map<string, FontResource>();
  private readonly facesByFamily = new Map<string, CSSFontFace[]>();
  private aliasCounter = 1;
  private embedder: FontEmbedder | null = null;
  private fontConfig: FontConfig | null = null;

  constructor(private readonly doc: PdfDocument, private readonly stylesheets: StyleSheets) {
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

  async ensureFontResource(family: string | undefined, weight?: number): Promise<FontResource> {
    const normalizedWeight = normalizeFontWeight(weight);
    const familyKey = this.makeFamilyKey(family, normalizedWeight);
    const cached = this.fontsByFamilyWeight.get(familyKey);
    if (cached) {
      return cached;
    }

    if (this.embedder && this.fontConfig) {
      const familyStack = family ? parseFamilyList(family) : this.fontConfig.defaultStack;
      const embedded = this.embedder.ensureFont(familyStack, normalizedWeight);
      if (embedded) {
        const resource: FontResource = {
          baseFont: embedded.baseFont,
          resourceName: embedded.resourceName,
          ref: embedded.ref,
          isBase14: false
        };
        this.fontsByFamilyWeight.set(familyKey, resource);
        return resource;
      }
    }

    const resolved = this.ensureStandardFontResource(family, normalizedWeight);
    this.fontsByFamilyWeight.set(familyKey, resolved);
    return resolved;
  }

  // New method to get embedder reference
  getEmbedder(): FontEmbedder | null {
    return this.embedder;
  }

  ensureFontResourceSync(family: string | undefined, weight?: number): FontResource {
    const normalizedWeight = normalizeFontWeight(weight);
    const familyKey = this.makeFamilyKey(family, normalizedWeight);
    const cached = this.fontsByFamilyWeight.get(familyKey);
    if (cached) {
      return cached;
    }
    const resolved = this.ensureStandardFontResource(family, normalizedWeight);
    this.fontsByFamilyWeight.set(familyKey, resolved);
    return resolved;
  }

  private ensureStandardFontResource(family: string | undefined, weight: number): FontResource {
    const candidates = [...parseFamilyList(family), DEFAULT_FONT];
    for (const candidate of candidates) {
      const normalizedCandidate = normalizeToken(candidate);
      if (!normalizedCandidate) {
        continue;
      }
      const candidateKey = this.familyWeightKey(normalizedCandidate, weight);
      const existing = this.fontsByFamilyWeight.get(candidateKey);
      if (existing) {
        this.fontsByFamilyWeight.set(this.makeFamilyKey(family, weight), existing);
        return existing;
      }
      const baseFont = this.resolveBaseFont(normalizedCandidate, weight);
      const resource = this.ensureBaseFontResource(baseFont);
      this.fontsByFamilyWeight.set(candidateKey, resource);
      this.fontsByFamilyWeight.set(this.makeFamilyKey(candidate, weight), resource);
      if (family && candidate !== family) {
        this.fontsByFamilyWeight.set(this.makeFamilyKey(family, weight), resource);
      }
      return resource;
    }
    const fallbackBase = this.applyWeightToBaseFont(DEFAULT_FONT, weight);
    const fallback = this.ensureBaseFontResource(fallbackBase);
    this.fontsByFamilyWeight.set(this.familyWeightKey("", weight), fallback);
    return fallback;
  }

  private resolveBaseFont(family: string, weight: number): string {
    const faces = this.facesByFamily.get(family);
    if (faces && faces.length > 0) {
      const selectedFace = selectFaceForWeight(faces, weight);
      if (selectedFace) {
        const base = baseFontFromFace(selectedFace);
        if (base) {
          return this.applyWeightToBaseFont(base, weight);
        }
      }
    }
    const alias = BASE_FONT_ALIASES.get(family);
    if (alias) {
      return this.applyWeightToBaseFont(alias, weight);
    }
    const generic = GENERIC_FAMILIES.get(family);
    if (generic) {
      return this.applyWeightToBaseFont(generic, weight);
    }
    return this.applyWeightToBaseFont(DEFAULT_FONT, weight);
  }

  private makeFamilyKey(family: string | undefined, weight: number): string {
    return this.familyWeightKey(normalizeToken(family), weight);
  }

  private familyWeightKey(normalizedFamily: string, weight: number): string {
    const familyToken = normalizedFamily && normalizedFamily.length > 0 ? normalizedFamily : "__default";
    return `${familyToken}@${fontWeightCacheKey(weight)}`;
  }

  private applyWeightToBaseFont(baseFont: string, weight: number): string {
    if (!isBoldFontWeight(weight)) {
      return baseFont;
    }
    if (/-bold$/i.test(baseFont)) {
      return baseFont;
    }
    switch (baseFont) {
      case "Helvetica":
        return "Helvetica-Bold";
      case "Times-Roman":
        return "Times-Bold";
      case "Courier":
        return "Courier-Bold";
      default:
        return baseFont;
    }
  }

  private ensureBaseFontResource(baseFont: string): FontResource {
    const existing = this.fontsByBaseFont.get(baseFont);
    if (existing) {
      return existing;
    }
    const ref = this.doc.registerStandardFont(baseFont);
    const alias = `F${this.aliasCounter++}`;
    const isBase14 = ["Helvetica", "Times-Roman", "Courier", "Symbol", "ZapfDingbats"].includes(baseFont);
    const resource: FontResource = { baseFont, resourceName: alias, ref, isBase14 };
    this.fontsByBaseFont.set(baseFont, resource);
    return resource;
  }

  async initializeEmbedder(fontConfig: FontConfig): Promise<void> {
    this.fontConfig = fontConfig;
    this.embedder = new FontEmbedder(fontConfig, this.doc);
    await this.embedder.initialize();
    log("FONT","DEBUG","embedder initialized", { fontConfig });
  }

  setFontConfig(fontConfig: FontConfig): void {
    this.fontConfig = fontConfig;
    this.embedder = new FontEmbedder(fontConfig, this.doc);
    log("FONT","DEBUG","font config set", { fontConfig });
  }
}

export function initFontSystem(doc: PdfDocument, stylesheets: StyleSheets): FontRegistry {
  return new FontRegistry(doc, stylesheets);
}

export async function ensureFontSubset(registry: FontRegistry, run: Run): Promise<FontResource> {
  const font = await registry.ensureFontResource(run.fontFamily, run.fontWeight);
  // === diagnóstico cirúrgico: caminho de fonte ===
  log("FONT", "INFO", "font-path", {
    base14: font.isBase14 === true,
    family: font.baseFont,
    encoding: font.isBase14 ? "WinAnsi" : "Identity-H"
  });
  return font;
}

export function ensureFontSubsetSync(registry: FontRegistry, run: Run): FontResource {
  const font = registry.ensureFontResourceSync(run.fontFamily, run.fontWeight);
  // === diagnóstico cirúrgico: caminho de fonte ===
  console.log(`[FONT_DEBUG] Run text: "${run.text}", fontFamily: "${run.fontFamily}", font.isBase14: ${font.isBase14}, font.baseFont: ${font.baseFont}, encoding: ${font.isBase14 ? "WinAnsi" : "Identity-H"}`);
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
  ["helvetica", "Helvetica"],
  ["arial", "Helvetica"],
  ["times", "Times-Roman"],
  ["times-roman", "Times-Roman"],
  ["times new roman", "Times-Roman"],
  ["georgia", "Times-Roman"],
  ["courier", "Courier"],
  ["courier new", "Courier"],
  ["monaco", "Courier"],
  ["symbol", "Symbol"],
  ["zapfdingbats", "ZapfDingbats"],
  ["notosans-regular", "NotoSans-Regular"],  // Unicode-capable font for bullets
]);

const GENERIC_FAMILIES = new Map<string, string>([
  ["serif", "Times-Roman"],
  ["sans-serif", "Helvetica"],
  ["monospace", "Courier"],
  ["system-ui", "Helvetica"],
  ["cursive", "Times-Roman"],
  ["fantasy", "Helvetica"],
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
