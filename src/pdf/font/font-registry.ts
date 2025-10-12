import type { CSSFontFace, Run, StyleSheets } from "../types.js";
import { PdfDocument, type PdfObjectRef } from "../primitives/pdf-document.js";
import type { FontConfig } from "../../types/fonts.js";
import { FontEmbedder } from "./embedder.js";

const DEFAULT_FONT = "Helvetica";

export interface FontResource {
  readonly baseFont: string;
  readonly resourceName: string;
  readonly ref: PdfObjectRef;
}

export class FontRegistry {
  private readonly fontsByFamily = new Map<string, FontResource>();
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

  async ensureFontResource(family: string | undefined): Promise<FontResource> {
    // First try to embed custom fonts if embedder is available
    if (this.embedder && this.fontConfig) {
      const familyStack = family ? parseFamilyList(family) : this.fontConfig.defaultStack;
      const embedded = this.embedder.ensureFont(familyStack);
      if (embedded) {
        const resource = {
          baseFont: embedded.baseFont,
          resourceName: embedded.resourceName,
          ref: embedded.ref
        };
        this.fontsByFamily.set(family || 'default', resource);
        return resource;
      }
    }

    // Fall back to standard font resolution
    return this.ensureStandardFontResource(family);
  }

  ensureFontResourceSync(family: string | undefined): FontResource {
    const candidates = [...parseFamilyList(family), DEFAULT_FONT];
    for (const candidate of candidates) {
      const normalized = normalizeToken(candidate);
      if (!normalized) {
        continue;
      }
      const existing = this.fontsByFamily.get(normalized);
      if (existing) {
        return existing;
      }
      const baseFont = this.resolveBaseFont(normalized);
      const resource = this.ensureBaseFontResource(baseFont);
      this.fontsByFamily.set(normalized, resource);
      return resource;
    }
    return this.ensureBaseFontResource(DEFAULT_FONT);
  }

  private ensureStandardFontResource(family: string | undefined): FontResource {
    const candidates = [...parseFamilyList(family), DEFAULT_FONT];
    for (const candidate of candidates) {
      const normalized = normalizeToken(candidate);
      if (!normalized) {
        continue;
      }
      const existing = this.fontsByFamily.get(normalized);
      if (existing) {
        return existing;
      }
      const baseFont = this.resolveBaseFont(normalized);
      const resource = this.ensureBaseFontResource(baseFont);
      this.fontsByFamily.set(normalized, resource);
      return resource;
    }
    return this.ensureBaseFontResource(DEFAULT_FONT);
  }

  private resolveBaseFont(family: string): string {
    const faces = this.facesByFamily.get(family);
    if (faces) {
      for (const face of faces) {
        const base = baseFontFromFace(face);
        if (base) {
          return base;
        }
      }
    }
    const alias = BASE_FONT_ALIASES.get(family);
    if (alias) {
      return alias;
    }
    const generic = GENERIC_FAMILIES.get(family);
    if (generic) {
      return generic;
    }
    return DEFAULT_FONT;
  }

  private ensureBaseFontResource(baseFont: string): FontResource {
    const existing = this.fontsByBaseFont.get(baseFont);
    if (existing) {
      return existing;
    }
    const ref = this.doc.registerStandardFont(baseFont);
    const alias = `F${this.aliasCounter++}`;
    const resource: FontResource = { baseFont, resourceName: alias, ref };
    this.fontsByBaseFont.set(baseFont, resource);
    return resource;
  }

  async initializeEmbedder(fontConfig: FontConfig): Promise<void> {
    this.fontConfig = fontConfig;
    this.embedder = new FontEmbedder(fontConfig, this.doc);
    await this.embedder.initialize();
  }

  setFontConfig(fontConfig: FontConfig): void {
    this.fontConfig = fontConfig;
    this.embedder = new FontEmbedder(fontConfig, this.doc);
  }
}

export function initFontSystem(doc: PdfDocument, stylesheets: StyleSheets): FontRegistry {
  return new FontRegistry(doc, stylesheets);
}

export async function ensureFontSubset(registry: FontRegistry, run: Run): Promise<FontResource> {
  return registry.ensureFontResource(run.fontFamily);
}

export function ensureFontSubsetSync(registry: FontRegistry, run: Run): FontResource {
  return registry.ensureFontResourceSync(run.fontFamily);
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
