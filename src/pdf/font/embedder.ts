import type { PdfObjectRef, PdfDocument } from "../primitives/pdf-document.js";
import { parseTtfBuffer } from "./ttf-lite.js";
import type { FontFaceDef, FontConfig, TtfFontMetrics } from "../../types/fonts.js";
import { log } from "../../debug/log.js";
import { normalizeFontWeight } from "../../css/font-weight.js";
import { detectFontFormat } from "../../fonts/detector.js";
import { reconstructTtf } from "../../fonts/utils/ttf-reconstructor.js";
import { computeWidths } from "./widths.js";
import { createToUnicodeCMapText } from "./to-unicode.js";

export { computeWidths } from "./widths.js";
export { createToUnicodeCMapText } from "./to-unicode.js";

const TYPICAL_STEM_V = 80;

export interface EmbeddedFont {
  readonly resourceName: string;
  readonly ref: PdfObjectRef;
  readonly baseFont: string;
  readonly metrics: TtfFontMetrics;
  readonly subset: Uint8Array;
}

interface FontDescriptor {
  readonly Type: "/FontDescriptor";
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
  readonly Type: "/Font";
  readonly Subtype: "/Type0";
  readonly BaseFont: string;
  readonly Encoding: "/Identity-H";
  readonly DescendantFonts: readonly [PdfObjectRef];
  readonly ToUnicode: PdfObjectRef;
}

interface CIDFontDictionary {
  readonly Type: "/Font";
  readonly Subtype: "/CIDFontType2";
  readonly BaseFont: string;
  readonly CIDSystemInfo: {
    readonly Registry: string; // emitted as literal strings "(Adobe)"
    readonly Ordering: string; // emitted as literal strings "(Identity)"
    readonly Supplement: 0;
  };
  readonly FontDescriptor: PdfObjectRef;
  readonly DW?: number;
  readonly W: readonly (number | readonly number[])[];
  readonly CIDToGIDMap: PdfObjectRef | string;
}

export class FontEmbedder {
  private embeddedFonts = new Map<string, EmbeddedFont>();
  private faceMetrics = new Map<string, TtfFontMetrics>();

  constructor(private readonly config: FontConfig, private readonly doc: PdfDocument) { }

  async initialize(): Promise<void> {
    for (const face of this.config.fontFaceDefs) {
      if (!face.data) {
        log("FONT", "ERROR", `Missing data for font ${face.name}`);
        continue;
      }
      try {
        let fontData = new Uint8Array(face.data);
        const format = detectFontFormat(fontData);
        let ttfBuffer: ArrayBuffer;
        if (format === "woff") {
          const parsed = await import("../../fonts/woff/decoder.js");
          const decoded = parsed.decodeWoff(fontData);
          ttfBuffer = reconstructTtf(decoded);
          fontData = new Uint8Array(ttfBuffer);
          (face as any).data = ttfBuffer;
        } else if (format === "woff2") {
          const { decodeWoff2 } = await import("../../fonts/woff2/decoder.js");
          const decoded = decodeWoff2(fontData);
          // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer unions
          const ttfCopy = decoded.ttfBuffer.slice();
          ttfBuffer = ttfCopy.buffer;
          fontData = new Uint8Array(ttfBuffer);
          (face as any).data = ttfBuffer;
        } else {
          ttfBuffer = face.data!;
        }

        const metrics = parseTtfBuffer(ttfBuffer);
        this.faceMetrics.set(face.name, metrics);
      } catch (error) {
        log("FONT", "ERROR", `Failed to load font ${face.name}`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  ensureFont(familyStack: string[], fontWeight?: number, fontStyle?: string): EmbeddedFont | null {
    const targetWeight = normalizeFontWeight(fontWeight);
    const wantsItalic = isItalic(fontStyle);

    for (const family of familyStack) {
      const normalizedFamily = family.toLowerCase().trim();
      const candidates = this.config.fontFaceDefs.filter((f) => {
        return (f.family || "").toLowerCase().trim() === normalizedFamily;
      });

      if (candidates.length === 0) {
        continue;
      }

      const face = pickFaceByWeight(candidates, targetWeight, wantsItalic);
      if (!face) {
        continue;
      }

      // Use normalized face name as key to avoid accidental mismatches due to spacing/case
      const faceKey = (face.name || "").toLowerCase().trim();
      const existing = this.embeddedFonts.get(face.name) ?? this.embeddedFonts.get(faceKey);
      if (existing) return existing;

      const embedded = this.embedFont(face);
      if (embedded) {
        // store with both canonical and normalized keys for resilient lookups
        this.embeddedFonts.set(face.name, embedded);
        this.embeddedFonts.set(faceKey, embedded);
        return embedded;
      }
    }

    return null;
  }

  private embedFont(face: FontFaceDef): EmbeddedFont | null {
    const metrics = this.faceMetrics.get(face.name);
    if (!metrics) return null;
    const unitsPerEm = metrics.metrics.unitsPerEm;
    const scaleTo1000 = (v: number) => Math.round((v / unitsPerEm) * 1000);

    let fontBBox: [number, number, number, number];
    if (metrics.headBBox) {
      const hb = metrics.headBBox;
      fontBBox = [scaleTo1000(hb[0]), scaleTo1000(hb[1]), scaleTo1000(hb[2]), scaleTo1000(hb[3])];
    } else {
      // Fallback if headBBox is missing
      fontBBox = [-1000, -1000, 1000, 1000];
    }

    // Register the font file stream
    // We need the full font data here. In the initialize method we updated face.data
    // but here we need to access it.
    // Since we can't easily change the interface, we'll assume face.data is the source.
    // If it was converted to TTF in initialize, face.data (casted) holds the TTF buffer.
    const fullFontData = new Uint8Array(face.data!);
    // FontFile2 streams require only /Length (PdfDocument adds it); avoid Type1-specific Length1 headers.
    const fontFileRef = this.doc.registerStream(fullFontData, {});

    const fontDescriptor: FontDescriptor = {
      Type: "/FontDescriptor",
      FontName: `/${face.name}`,
      Flags: computePdfFlagsFromFace(face),
      FontBBox: fontBBox,
      ItalicAngle: face.style === "italic" ? -12 : 0,
      Ascent: scaleTo1000(metrics.metrics.ascender),
      Descent: scaleTo1000(metrics.metrics.descender),
      CapHeight: scaleTo1000(metrics.metrics.capHeight),
      XHeight: scaleTo1000(metrics.metrics.xHeight),
      StemV: TYPICAL_STEM_V,
      FontFile2: fontFileRef
    };

    const fontDescriptorRef = this.doc.register(fontDescriptor);

    // Compute DW and compressed W
    const { DW, W } = computeWidths(metrics);

    // Create CID font dictionary (include DW)
    // CID fonts must declare string-valued CIDSystemInfo entries per PDF spec.
    const cidFontDict: CIDFontDictionary = {
      Type: "/Font",
      Subtype: "/CIDFontType2",
      BaseFont: `/${face.name}`,
      CIDSystemInfo: {
        Registry: "(Adobe)",
        Ordering: "(Identity)",
        Supplement: 0
      },
      FontDescriptor: fontDescriptorRef,
      DW,
      W,
      // Rely on built-in Identity CIDToGID mapping to keep font dictionaries simple/compatible.
      CIDToGIDMap: "/Identity"
    };

    const cidFontRef = this.doc.register(cidFontDict);

    // Create Unicode mapping (ToUnicode CMap)
    const toUnicodeRef = this.createToUnicodeCMap(metrics);

    // Create Type0 font dictionary
    // Per PDF spec, Type0 BaseFont should include the CMap suffix (e.g. "-Identity-H")
    // to make the composite font name unambiguous for parsers/renderers.
    const type0Font: FontDictionary = {
      Type: "/Font",
      Subtype: "/Type0",
      BaseFont: `/${face.name}-Identity-H`,
      Encoding: "/Identity-H",
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



  private createToUnicodeCMap(metrics: TtfFontMetrics, _uniqueUnicodes: number[] = []): PdfObjectRef {
    // Build inverse mapping gid -> unicode (pick first unicode when multiple map to same gid)
    const unicodeMap = metrics.cmap["unicodeMap"] as Map<number, number>;
    log("FONT", "DEBUG", "createToUnicodeCMap - unicodeMap size", { size: unicodeMap.size });

    // Sample first few entries for debugging
    const samples: Array<{ unicode: number, char: string, gid: number }> = [];
    let count = 0;
    for (const [unicode, gid] of unicodeMap.entries()) {
      if (count < 10) {
        samples.push({ unicode, char: String.fromCodePoint(unicode), gid });
      }
      count++;
    }
    log("FONT", "DEBUG", "createToUnicodeCMap - sample entries", { samples });

    const gidToUni = new Map<number, number>();
    for (const [unicode, gid] of unicodeMap.entries()) {
      if (!gidToUni.has(gid)) gidToUni.set(gid, unicode);
    }

    // Debug: log sample gid->unicode mappings
    const gidSamples: Array<{ gid: number, unicode: number, char: string }> = [];
    let gidCount = 0;
    for (const [gid, unicode] of gidToUni.entries()) {
      if (gidCount < 20) {
        gidSamples.push({ gid, unicode, char: String.fromCodePoint(unicode) });
      }
      gidCount++;
    }
    log("FONT", "DEBUG", "createToUnicodeCMap - gid->unicode sample", { samples: gidSamples });

    const entries = Array.from(gidToUni.entries())
      .map(([gid, unicode]) => ({ gid, unicode }))
      .sort((a, b) => a.gid - b.gid);

    const cmapText = createToUnicodeCMapText(entries);
    return this.doc.registerStream(new TextEncoder().encode(cmapText), {});
  }


  /**
   * Return parsed TTF metrics for a loaded face by name, or null if not available.
   * Exposed to allow rendering code to access outlines/metrics for embedding masks.
   */
  public getMetrics(faceName: string): TtfFontMetrics | null {
    return this.faceMetrics.get(faceName) ?? null;
  }
}

function pickFaceByWeight(faces: FontFaceDef[], requestedWeight: number, wantsItalic: boolean): FontFaceDef | null {
  if (faces.length === 0) {
    return null;
  }
  // Prefer faces that match the requested style; if none do, fall back to any style.
  const styleFiltered = faces.filter((face) => isItalic(face.style) === wantsItalic);
  const pool = styleFiltered.length > 0 ? styleFiltered : faces;

  let bestFace = pool[0];
  let bestDiff = Math.abs(normalizeFontWeight(bestFace.weight) - requestedWeight);
  for (const face of pool) {
    const normalized = normalizeFontWeight(face.weight);
    const diff = Math.abs(normalized - requestedWeight);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestFace = face;
    }
  }
  return bestFace;
}

function isItalic(style: string | undefined): boolean {
  if (!style) return false;
  const s = style.toLowerCase();
  return s === "italic" || s === "oblique";
}

// Compute PDF Flags based on font family/style heuristics.
// See AGENTS.md notes for bits: Symbolic vs Nonsymbolic, Serif, Italic, etc.
function computePdfFlagsFromFace(face: FontFaceDef): number {
  let flags = 0;
  const family = (face.family || "").toLowerCase().trim();
  const name = (face.name || "").toLowerCase().trim();
  const style = (face.style || "").toLowerCase();

  const isItalic = /italic|oblique/i.test(style);
  const isSerif = /serif/i.test(family) || /serif/i.test(name);
  const isSymbol = /symbol|dingbat|dingbats|zapfdingbats/i.test(family) || /symbol|dingbat|dingbats/i.test(name);

  if (isSymbol) flags |= 1 << 2; // Symbolic
  else flags |= 1 << 5; // Nonsymbolic

  if (isSerif) flags |= 1 << 1; // Serif
  if (isItalic) flags |= 1 << 6; // Italic

  return flags;
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
