import type { PdfObjectRef, PdfDocument } from "../primitives/pdf-document.js";
import { parseTtfFont } from "./ttf-lite.js";
import type { FontFaceDef, FontConfig, TtfFontMetrics } from "../../types/fonts.js";
import { log } from "../../debug/log.js";
import { normalizeFontWeight } from "../../css/font-weight.js";

const SYMBOLIC_FONT_FLAGS = 4;
const TYPICAL_STEM_V = 80;

export interface EmbeddedFont {
  readonly resourceName: string;
  readonly ref: PdfObjectRef;
  readonly baseFont: string;
  readonly metrics: TtfFontMetrics;
  readonly subset: Uint8Array;
}

interface FontDescriptor {
  readonly Type: "FontDescriptor";
  readonly FontName: string;
  readonly Flags: number;
  readonly FontBBox: readonly [number, number, number, number];
  readonly ItalicAngle: number;
  readonly Ascent: number;
  readonly Descent: number;
  readonly CapHeight: number;
  readonly XHeight: number;
  readonly StemV: number;
  readonly FontFile2: PdfObjectRef;
}

interface FontDictionary {
  readonly Type: "Font";
  readonly Subtype: "Type0";
  readonly BaseFont: string;
  readonly Encoding: "Identity-H";
  readonly DescendantFonts: readonly [PdfObjectRef];
  readonly ToUnicode: PdfObjectRef;
}

interface CIDFontDictionary {
  readonly Type: "Font";
  readonly Subtype: "CIDFontType2";
  readonly BaseFont: string;
  readonly CIDSystemInfo: {
    readonly Registry: "Adobe";
    readonly Ordering: "Identity";
    readonly Supplement: 0;
  };
  readonly FontDescriptor: PdfObjectRef;
  readonly W: readonly (readonly [number] | readonly [number, readonly number[]])[];
  readonly CIDToGIDMap: PdfObjectRef;
}

export class FontEmbedder {
  private embeddedFonts = new Map<string, EmbeddedFont>();
  private faceMetrics = new Map<string, TtfFontMetrics>();

  constructor(
    private readonly config: FontConfig,
    private readonly doc: PdfDocument
  ) {}

  async initialize(): Promise<void> {
    for (const face of this.config.fontFaceDefs) {
      try {
        // TODO: Parse from pre-loaded data once parseTtfFont supports it
        const metrics = parseTtfFont(face.src);
        this.faceMetrics.set(face.name, metrics);
      } catch (error) {
        log("FONT", "ERROR", `Failed to load font ${face.name}`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  ensureFont(familyStack: string[], fontWeight?: number): EmbeddedFont | null {
    const targetWeight = normalizeFontWeight(fontWeight);
    for (const family of familyStack) {
      const candidates = this.config.fontFaceDefs.filter((f) => f.family === family);
      if (candidates.length === 0) {
        continue;
      }
      const face = pickFaceByWeight(candidates, targetWeight);
      if (!face) {
        continue;
      }
      const existing = this.embeddedFonts.get(face.name);
      if (existing) return existing;

      const embedded = this.embedFont(face);
      if (embedded) {
        this.embeddedFonts.set(face.name, embedded);
        return embedded;
      }
    }
    return null;
  }

  private embedFont(face: FontFaceDef): EmbeddedFont | null {
    const metrics = this.faceMetrics.get(face.name);
    if (!metrics) return null;

    log("FONT","DEBUG","embedding font", { face, glyphCount: metrics.glyphMetrics.size });

    // Create font subset (simplified - just the full TTF for now)
    const fullFontData = this.loadFontData(face.src);
    const fontFileRef = this.doc.registerStream(fullFontData, {
      Length: fullFontData.length.toString(),
      Filter: "/FlateDecode"
    });

    // Create font descriptor
    const fontDescriptor: FontDescriptor = {
      Type: "FontDescriptor",
      FontName: `/${face.name}`,
      Flags: SYMBOLIC_FONT_FLAGS, // Symbolic font
      FontBBox: [-100, -300, 1000, 900], // Simplified bbox
      ItalicAngle: face.style === "italic" ? -12 : 0,
      Ascent: metrics.metrics.ascender,
      Descent: metrics.metrics.descender,
      CapHeight: metrics.metrics.capHeight,
      XHeight: metrics.metrics.xHeight,
      StemV: TYPICAL_STEM_V, // Typical value
      FontFile2: fontFileRef
    };

    const fontDescriptorRef = this.doc.register(fontDescriptor);

    // Create CID font dictionary
    const cidFontDict: CIDFontDictionary = {
      Type: "Font",
      Subtype: "CIDFontType2",
      BaseFont: face.name,
      CIDSystemInfo: {
        Registry: "Adobe",
        Ordering: "Identity",
        Supplement: 0
      },
      FontDescriptor: fontDescriptorRef,
      W: this.buildWidthsArray(metrics),
      CIDToGIDMap: this.doc.registerStream(new Uint8Array(), { Length: "0" }) // Identity mapping
    };

    const cidFontRef = this.doc.register(cidFontDict);

    // Create Unicode mapping (ToUnicode CMap)
    const toUnicodeRef = this.createToUnicodeCMap(metrics);

    // Create Type0 font dictionary
    const type0Font: FontDictionary = {
      Type: "Font",
      Subtype: "Type0",
      BaseFont: `${face.name}`,
      Encoding: "Identity-H",
      DescendantFonts: [cidFontRef],
      ToUnicode: toUnicodeRef
    };

    const fontRef = this.doc.register(type0Font);

    return {
      resourceName: `F${this.embeddedFonts.size + 1}`,
      ref: fontRef,
      baseFont: face.name,
      metrics,
      subset: fullFontData
    };
  }

  private buildWidthsArray(metrics: TtfFontMetrics): CIDFontDictionary["W"] {
    const widths: (readonly [number] | readonly [number, readonly number[]])[] = [];
    let startGlyph = -1;
    let currentWidths: number[] = [];

    for (const [glyphId, glyphMetrics] of metrics.glyphMetrics) {
      if (startGlyph === -1) {
        startGlyph = glyphId;
      }

      const width = glyphMetrics.advanceWidth / metrics.metrics.unitsPerEm * 1000;
      currentWidths.push(Math.round(width));

      // Group consecutive glyphs with similar patterns (simplified)
      if (currentWidths.length > 10) {
        widths.push([startGlyph, currentWidths]);
        startGlyph = -1;
        currentWidths = [];
      }
    }

    if (currentWidths.length > 0) {
      widths.push([startGlyph, currentWidths]);
    }

    return widths;
  }

  private createToUnicodeCMap(metrics: TtfFontMetrics, uniqueUnicodes: number[] = []): PdfObjectRef {
    // For each unique Unicode codepoint used in document, map CID to Unicode
    const mappings: string[] = [];
    const allUnicodes = new Set([...uniqueUnicodes, ...Array.from(metrics.cmap["unicodeMap"].keys())]);

    for (const unicode of allUnicodes) {
      const glyphId = metrics.cmap["unicodeMap"].get(unicode);
      if (glyphId !== undefined) {
        const cid = glyphId.toString(16).padStart(4, '0').toUpperCase();
        const uni = unicode.toString(16).padStart(4, '0').toUpperCase();
        mappings.push(`<${cid}> <${uni}>`);
      }
    }

    const cmap = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo <<
  /Registry (Adobe)
  /Ordering (UCS)
  /Supplement 0
>> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
${mappings.length} beginbfchar
${mappings.join('\n')}
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;

    return this.doc.registerStream(
      new TextEncoder().encode(cmap),
      { Length: cmap.length.toString() }
    );
  }


  private async loadFontDataAsync(path: string): Promise<Uint8Array> {
    // Load the full TTF file asynchronously (later we can implement subsetting)
    const { readFile } = require("fs/promises");
    return await readFile(path);
  }

  private loadFontData(path: string): Uint8Array {
    // Legacy synchronous method for compatibility (to be removed)
    const { readFileSync } = require("fs");
    return readFileSync(path);
  }
}

function pickFaceByWeight(faces: FontFaceDef[], requestedWeight: number): FontFaceDef | null {
  if (faces.length === 0) {
    return null;
  }
  let bestFace = faces[0];
  let bestDiff = Math.abs(normalizeFontWeight(bestFace.weight) - requestedWeight);
  for (const face of faces) {
    const normalized = normalizeFontWeight(face.weight);
    const diff = Math.abs(normalized - requestedWeight);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestFace = face;
    }
  }
  return bestFace;
}

export async function getEmbeddedFont(name: "NotoSans-Regular" | "DejaVuSans", doc: PdfDocument, config: FontConfig): Promise<EmbeddedFont | null> {
  const embedder = new FontEmbedder(config, doc);
  const face = config.fontFaceDefs.find(f => f.name === name);
  if (!face) return null;

  const existing = embedder['embeddedFonts'].get(name);
  if (existing) return existing;

  // @ts-ignore: TypeScript complains about private method, but this is intentional for testing
  const embedded = embedder['embedFont'](face);
  if (embedded) {
    embedder['embeddedFonts'].set(name, embedded);
    return embedded;
  }
  return null;
}

export function buildToUnicodeCMap(uniqueCodepoints: number[]): string {
  const mappings: string[] = [];
  for (const cp of uniqueCodepoints) {
    const cid = cp.toString(16).padStart(4, '0').toUpperCase();
    const uni = cp.toString(16).padStart(4, '0').toUpperCase();
    mappings.push(`<${cid}> <${uni}>`);
  }

  return `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo <<
  /Registry (Adobe)
  /Ordering (UCS)
  /Supplement 0
>> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
${mappings.length} beginbfchar
${mappings.join('\n')}
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
}
