import type { PdfObjectRef, PdfDocument } from "../primitives/pdf-document.js";
import { parseTtfBuffer } from "./ttf-lite.js";
import type { FontFaceDef, FontConfig, TtfFontMetrics } from "../../types/fonts.js";
import { log } from "../../debug/log.js";
import { normalizeFontWeight } from "../../css/font-weight.js";
import { detectFontFormat } from "../../fonts/detector.js";
import { reconstructTtf } from "../../fonts/utils/ttf-reconstructor.js";

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

/**
 * Compute DW (default width) and compressed W array from glyph metrics.
 * Exported so it can be unit-tested.
 */
export function computeWidths(metrics: TtfFontMetrics): { DW: number; W: CIDFontDictionary["W"] } {
  const count = metrics.glyphMetrics.size;
  const widths: number[] = new Array(count).fill(0);
  for (const [gid, gm] of metrics.glyphMetrics) {
    widths[gid] = Math.round((gm.advanceWidth / metrics.metrics.unitsPerEm) * 1000);
  }

  const computeDW = (arr: number[]) => {
    const freq = new Map<number, number>();
    for (const v of arr) {
      // Skip zero widths; a DW of 0 breaks Identity-H rendering in some viewers.
      if (v === 0) continue;
      freq.set(v, (freq.get(v) ?? 0) + 1);
    }
    // Fallback to 1000 if we only saw zeros.
    if (freq.size === 0) {
      return 1000;
    }
    let best = 1000;
    let bestCount = -1;
    for (const [v, c] of freq.entries()) {
      if (c > bestCount || (c === bestCount && v < best)) {
        best = v;
        bestCount = c;
      }
    }
    return best;
  };

  const DW = computeDW(widths);

  // Compress widths into W entries using ranges for repeating values and arrays for heterogenous runs
  // The PDF spec requires a flat array of mixed types:
  // c [w1 w2 ... wn]
  // c_first c_last w
  const result: (number | number[])[] = [];
  let i = 0;
  while (i < count) {
    // skip DW values
    if (widths[i] === DW) {
      i++;
      continue;
    }

    // try find long run of identical width (use range if length >= 4)
    const start = i;
    const val = widths[i];
    let j = i + 1;
    while (j < count && widths[j] === val) j++;
    const runLen = j - start;
    if (runLen >= 4) {
      // c_first c_last w
      result.push(start);
      result.push(j - 1);
      result.push(val);
      i = j;
      continue;
    }

    // otherwise build a heterogenous list until we hit DW or reach a reasonable chunk (32)
    const listStart = i;
    const list: number[] = [];
    while (i < count && widths[i] !== DW && list.length < 32) {
      list.push(widths[i]);
      i++;
    }
    // c [w1 ... wn]
    result.push(listStart);
    result.push(list);
  }

  return { DW, W: result };
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
        const metrics = parseTtfBuffer(face.data!); // Use the potentially updated data
        this.faceMetrics.set(face.name, metrics);
      } catch (error) {
        log("FONT", "ERROR", `Failed to load font ${face.name}`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  ensureFont(familyStack: string[], fontWeight?: number): EmbeddedFont | null {
    const targetWeight = normalizeFontWeight(fontWeight);

    for (const family of familyStack) {
      const normalizedFamily = family.toLowerCase().trim();
      const candidates = this.config.fontFaceDefs.filter((f) => {
        return (f.family || "").toLowerCase().trim() === normalizedFamily;
      });

      if (candidates.length === 0) {
        continue;
      }

      const face = pickFaceByWeight(candidates, targetWeight);
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

    const entries: { gid: number; unicode: number }[] = [];
    for (const [gid, unicode] of gidToUni.entries()) {
      entries.push({ gid, unicode });
    }
    entries.sort((a, b) => a.gid - b.gid);

    // Helper: encode a Unicode code point to UTF-16BE hex string (handles non-BMP via surrogate pairs)
    const uniToUtf16Hex = (cp: number): string => {
      if (cp <= 0xffff) {
        return cp.toString(16).padStart(4, "0").toUpperCase();
      }
      // surrogate pair
      const v = cp - 0x10000;
      const hi = 0xd800 + (v >> 10);
      const lo = 0xdc00 + (v & 0x3ff);
      return hi.toString(16).padStart(4, "0").toUpperCase() + lo.toString(16).padStart(4, "0").toUpperCase();
    };

    // Build mapping directives: try to form bfrange for consecutive gid->unicode sequences
    type Mapping = { type: "range"; startG: number; endG: number; startU: number } | { type: "char"; gid: number; unicode: number };
    const mappings: Mapping[] = [];
    let idx = 0;
    while (idx < entries.length) {
      const start = entries[idx];
      let j = idx + 1;
      // extend consecutive runs where gid increments by 1 and unicode increments by 1
      while (
        j < entries.length &&
        entries[j].gid === entries[j - 1].gid + 1 &&
        entries[j].unicode === entries[j - 1].unicode + 1
      ) {
        j++;
      }
      const runLen = j - idx;
      if (runLen >= 2) {
        // use bfrange for linear runs
        mappings.push({ type: "range", startG: start.gid, endG: entries[j - 1].gid, startU: start.unicode });
        idx = j;
      } else {
        mappings.push({ type: "char", gid: start.gid, unicode: start.unicode });
        idx++;
      }
    }

    // Emit CMap with blocks: group same-type mappings into chunks to emit beginbfchar / beginbfrange blocks.
    const lines: string[] = [];
    lines.push("/CIDInit /ProcSet findresource begin");
    lines.push("12 dict begin");
    lines.push("begincmap");
    lines.push("/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def");
    lines.push("/CMapName /Adobe-Identity-UCS def");
    lines.push("/CMapType 2 def");
    lines.push("1 begincodespacerange");
    // source CIDs are represented as 2-byte values here
    lines.push("<0000> <FFFF>");
    lines.push("endcodespacerange");

    const CHUNK = 100;
    let p = 0;
    while (p < mappings.length) {
      const currentType = mappings[p].type;
      const group: Mapping[] = [];
      while (p < mappings.length && mappings[p].type === currentType && group.length < CHUNK) {
        group.push(mappings[p]);
        p++;
      }

      if (currentType === "char") {
        lines.push(`${group.length} beginbfchar`);
        for (const m of group as { type: "char"; gid: number; unicode: number }[]) {
          const cid = m.gid.toString(16).padStart(4, "0").toUpperCase();
          const uniHex = uniToUtf16Hex(m.unicode);
          lines.push(`<${cid}> <${uniHex}>`);
        }
        lines.push("endbfchar");
      } else {
        lines.push(`${group.length} beginbfrange`);
        for (const m of group as { type: "range"; startG: number; endG: number; startU: number }[]) {
          const startCid = m.startG.toString(16).padStart(4, "0").toUpperCase();
          const endCid = m.endG.toString(16).padStart(4, "0").toUpperCase();
          const startUniHex = uniToUtf16Hex(m.startU);
          lines.push(`<${startCid}> <${endCid}> <${startUniHex}>`);
        }
        lines.push("endbfrange");
      }
    }

    lines.push("endcmap");
    lines.push("CMapName currentdict /CMap defineresource pop");
    lines.push("end");
    lines.push("end");

    const cmapText = lines.join("\n");
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

/**
 * Build ToUnicode CMap text from explicit gid->unicode mappings.
 * Entries must be ordered by gid for best results but ordering is not required.
 * Supports non-BMP code points by emitting UTF-16BE surrogate pairs.
 *
 * Output is a textual CMap ready to be registered as a PDF stream.
 */
export function createToUnicodeCMapText(entries: { gid: number; unicode: number }[]): string {
  if (!entries || entries.length === 0) {
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
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
  }

  // sort by gid
  const es = entries.slice().sort((a, b) => a.gid - b.gid);

  const uniToUtf16Hex = (cp: number): string => {
    if (cp <= 0xffff) {
      return cp.toString(16).padStart(4, "0").toUpperCase();
    }
    const v = cp - 0x10000;
    const hi = 0xd800 + (v >> 10);
    const lo = 0xdc00 + (v & 0x3ff);
    return hi.toString(16).padStart(4, "0").toUpperCase() + lo.toString(16).padStart(4, "0").toUpperCase();
  };

  // Build mapping directives (group consecutive linear runs into ranges)
  type Mapping = { type: "range"; startG: number; endG: number; startU: number } | { type: "char"; gid: number; unicode: number };
  const mappings: Mapping[] = [];
  let i = 0;
  while (i < es.length) {
    const start = es[i];
    let j = i + 1;
    while (
      j < es.length &&
      es[j].gid === es[j - 1].gid + 1 &&
      es[j].unicode === es[j - 1].unicode + 1
    ) {
      j++;
    }
    const runLen = j - i;
    if (runLen >= 2) {
      mappings.push({ type: "range", startG: start.gid, endG: es[j - 1].gid, startU: start.unicode });
      i = j;
    } else {
      mappings.push({ type: "char", gid: start.gid, unicode: start.unicode });
      i++;
    }
  }

  const lines: string[] = [];
  lines.push("/CIDInit /ProcSet findresource begin");
  lines.push("12 dict begin");
  lines.push("begincmap");
  lines.push("/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def");
  lines.push("/CMapName /Adobe-Identity-UCS def");
  lines.push("/CMapType 2 def");
  lines.push("1 begincodespacerange");
  lines.push("<0000> <FFFF>");
  lines.push("endcodespacerange");

  const CHUNK = 100;
  let p = 0;
  while (p < mappings.length) {
    const currentType = mappings[p].type;
    const group: Mapping[] = [];
    while (p < mappings.length && mappings[p].type === currentType && group.length < CHUNK) {
      group.push(mappings[p]);
      p++;
    }

    if (currentType === "char") {
      lines.push(`${group.length} beginbfchar`);
      for (const m of group as { type: "char"; gid: number; unicode: number }[]) {
        const cid = m.gid.toString(16).padStart(4, "0").toUpperCase();
        const uniHex = uniToUtf16Hex(m.unicode);
        lines.push(`<${cid}> <${uniHex}>`);
      }
      lines.push("endbfchar");
    } else {
      lines.push(`${group.length} beginbfrange`);
      for (const m of group as { type: "range"; startG: number; endG: number; startU: number }[]) {
        const startCid = m.startG.toString(16).padStart(4, "0").toUpperCase();
        const endCid = m.endG.toString(16).padStart(4, "0").toUpperCase();
        const startUniHex = uniToUtf16Hex(m.startU);
        lines.push(`<${startCid}> <${endCid}> <${startUniHex}>`);
      }
      lines.push("endbfrange");
    }
  }

  lines.push("endcmap");
  lines.push("CMapName currentdict /CMap defineresource pop");
  lines.push("end");
  lines.push("end");

  return lines.join("\n");
}
