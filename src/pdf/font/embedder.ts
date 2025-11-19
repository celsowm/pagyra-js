import type { PdfObjectRef, PdfDocument } from "../primitives/pdf-document.js";
import { parseTtfBuffer } from "./ttf-lite.js";
import type { FontFaceDef, FontConfig, TtfFontMetrics } from "../../types/fonts.js";
import { log } from "../../debug/log.js";
import { normalizeFontWeight } from "../../css/font-weight.js";
import { detectFontFormat } from "../../fonts/detector.js";
import { Woff2Engine } from "../../fonts/engines/woff2-engine.js";
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
  readonly DW?: number;
  readonly W: readonly (readonly [number] | readonly [number, readonly number[]])[];
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
      freq.set(v, (freq.get(v) ?? 0) + 1);
    }
    let best = arr[0] || 0;
    let bestCount = 0;
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
  const result: any[] = [];
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
      // [start end value]
      result.push([start, j - 1, val]);
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
    result.push([listStart, list]);
  }

  return { DW, W: result as CIDFontDictionary["W"] };
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

        if (format === 'woff2') {
          log("FONT", "DEBUG", `Detected WOFF2 font for ${face.name}, converting to TTF for embedding`);
          try {
            const engine = new Woff2Engine();
            const parsed = await engine.parse(fontData);
            const ttfBuffer = reconstructTtf(parsed);
            fontData = new Uint8Array(ttfBuffer);
            // Update the face data so subsequent usages (like embedding) use the converted TTF
            // Note: We can't easily update the readonly face.data, but we can use the local fontData
            // for metrics parsing. For embedding, we might need to store the converted data.
            // However, since face.data is readonly in the interface, we'll just use the converted buffer
            // for metrics parsing here. The actual embedding (embedFont) also needs the data.
            // We'll store the converted data in a side map or cast to any to update.
            // For now, let's cast to any to update the cache in config (dirty but effective for this fix)
            (face as any).data = ttfBuffer;
          } catch (e) {
            log("FONT", "ERROR", `Failed to convert WOFF2 font ${face.name}`, { error: e instanceof Error ? e.message : String(e) });
            // Continue and try parsing as is (will likely fail if it's still WOFF2)
          }
        }

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

    log("FONT", "DEBUG", "embedding font", { face, glyphCount: metrics.glyphMetrics.size });

    // Create font subset (simplified - just the full TTF for now)
    const fullFontData = new Uint8Array(face.data!);
    const fontFileRef = this.doc.registerStream(fullFontData, {
      Filter: "/FlateDecode"
    });

    // Create font descriptor
    // Compute PDF FontDescriptor fields and scale metrics to 1000 UPM
    const unitsPerEm = metrics.metrics.unitsPerEm || 1000;
    const scaleTo1000 = (v: number) => Math.round((v * 1000) / unitsPerEm);

    // Use head bbox when available, otherwise fall back to a conservative box
    let fontBBox: [number, number, number, number] = [-100, -300, 1000, 900];
    // metrics may include headBBox from parser
    // @ts-ignore - metrics may have headBBox added by parser
    if ((metrics as any).headBBox) {
      // headBBox in font units [xMin,yMin,xMax,yMax] -> scale to 1000
      // ensure we copy to typed array
      const hb = (metrics as any).headBBox as [number, number, number, number];
      fontBBox = [scaleTo1000(hb[0]), scaleTo1000(hb[1]), scaleTo1000(hb[2]), scaleTo1000(hb[3])];
    } else {
      fontBBox = fontBBox.map((v) => Math.round(v * (1000 / unitsPerEm))) as [number, number, number, number];
    }

    const fontDescriptor: FontDescriptor = {
      Type: "FontDescriptor",
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
      DW,
      W,
      CIDToGIDMap: "/Identity"
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
