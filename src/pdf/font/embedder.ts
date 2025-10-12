import type { PdfObjectRef } from "../primitives/pdf-document.js";
import { parseTtfFont } from "./ttf-lite.js";
import type { FontFaceDef, FontConfig, TtfFontMetrics } from "../../types/fonts.js";
import { log } from "../../debug/log.js";

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
    private readonly doc: any // PdfDocument type
  ) {}

  async initialize(): Promise<void> {
    for (const face of this.config.fontFaceDefs) {
      try {
        const metrics = parseTtfFont(face.src);
        this.faceMetrics.set(face.name, metrics);
      } catch (error) {
        console.warn(`Failed to load font ${face.name}:`, error);
      }
    }
  }

  ensureFont(familyStack: string[]): EmbeddedFont | null {
    for (const family of familyStack) {
      const face = this.config.fontFaceDefs.find(f => f.family === family);
      if (face) {
        const existing = this.embeddedFonts.get(face.name);
        if (existing) return existing;

        const embedded = this.embedFont(face);
        if (embedded) {
          this.embeddedFonts.set(face.name, embedded);
          return embedded;
        }
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
      Length: fullFontData.length,
      Filter: "/FlateDecode"
    });

    // Create font descriptor
    const fontDescriptor: FontDescriptor = {
      Type: "FontDescriptor",
      FontName: `/${face.name}`,
      Flags: 4, // Symbolic font
      FontBBox: [-100, -300, 1000, 900], // Simplified bbox
      ItalicAngle: face.style === "italic" ? -12 : 0,
      Ascent: metrics.metrics.ascender,
      Descent: metrics.metrics.descender,
      CapHeight: metrics.metrics.capHeight,
      XHeight: metrics.metrics.xHeight,
      StemV: 80, // Typical value
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
      CIDToGIDMap: this.doc.registerStream(new Uint8Array(), { Length: 0 }) // Identity mapping
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

  private createToUnicodeCMap(metrics: TtfFontMetrics): PdfObjectRef {
    // Create a simple ToUnicode CMap
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
`;

    // Build glyph to unicode mappings
    const mappings: string[] = [];
    let totalMappings = 0;

    for (const [codePoint, glyphId] of metrics.cmap["unicodeMap"]) {
      if (totalMappings >= 100) break; // Limit for brevity
      const cid = glyphId.toString(16).padStart(4, '0').toUpperCase();
      const unicode = codePoint.toString(16).padStart(4, '0').toUpperCase();
      mappings.push(`<${cid}> <${unicode}>`);
      totalMappings++;
    }

    const cmapEnd = `
${mappings.length} beginbfchar
${mappings.join('\n')}
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end
`;

    const fullCmap = cmap + cmapEnd;
    return this.doc.registerStream(
      new TextEncoder().encode(fullCmap),
      { Length: fullCmap.length }
    );
  }


  private loadFontData(path: string): Uint8Array {
    // For now, load the full TTF file (later we can implement subsetting)
    const { readFileSync } = require("fs");
    return readFileSync(path);
  }
}

export async function getEmbeddedFont(name: "NotoSans-Regular" | "DejaVuSans", doc: any, config: FontConfig): Promise<EmbeddedFont | null> {
  const embedder = new FontEmbedder(config, doc);
  const face = config.fontFaceDefs.find(f => f.name === name);
  if (!face) return null;

  const existing = embedder['embeddedFonts'].get(name);
  if (existing) return existing;

  const embedded = embedder.embedFont(face);
  if (embedded) {
    embedder['embeddedFonts'].set(name, embedded);
    return embedded;
  }
  return null;
}
