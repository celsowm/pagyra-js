export interface FontConfig {
  readonly fontFaceDefs: FontFaceDef[];
  readonly defaultStack: string[];
}

export interface FontFaceDef {
  readonly name: string;
  readonly family: string;
  readonly weight: number;
  readonly style: 'normal' | 'italic';
  readonly src: string; // path to TTF file
}

export interface TtfMetrics {
  readonly unitsPerEm: number;
  readonly ascender: number;
  readonly descender: number;
  readonly lineGap: number;
  readonly capHeight: number;
  readonly xHeight: number;
}

export interface GlyphMetrics {
  readonly advanceWidth: number;
  readonly leftSideBearing: number;
}

export interface CmapData {
  readonly getGlyphId: (codePoint: number) => number;
  readonly hasCodePoint: (codePoint: number) => boolean;
  readonly unicodeMap: Map<number, number>; // Internal access for CMap generation
}

export class TtfFontMetrics {
  constructor(
    public readonly metrics: TtfMetrics,
    public readonly glyphMetrics: Map<number, GlyphMetrics>,
    public readonly cmap: CmapData,
    // optional head bbox in font units [xMin, yMin, xMax, yMax]
    public readonly headBBox?: readonly [number, number, number, number]
  ) {}
}
