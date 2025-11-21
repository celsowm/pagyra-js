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
  readonly data?: ArrayBuffer;
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

export type KerningMap = Map<number, Map<number, number>>;

export interface CmapData {
  readonly getGlyphId: (codePoint: number) => number;
  readonly hasCodePoint: (codePoint: number) => boolean;
  readonly unicodeMap: Map<number, number>; // Internal access for CMap generation
}

export type GlyphOutlineCmd =
  | { type: "moveTo"; x: number; y: number }
  | { type: "lineTo"; x: number; y: number }
  | { type: "quadTo"; cx: number; cy: number; x: number; y: number } // quadratic Bézier
  | { type: "cubicTo"; cx1: number; cy1: number; cx2: number; cy2: number; x: number; y: number } // cubic Bézier
  | { type: "close" };

export class TtfFontMetrics {
  constructor(
    public readonly metrics: TtfMetrics,
    public readonly glyphMetrics: Map<number, GlyphMetrics>,
    public readonly cmap: CmapData,
    // optional head bbox in font units [xMin, yMin, xMax, yMax]
    public readonly headBBox?: readonly [number, number, number, number],
    /**
     * Optional hook that returns a glyph's outline command sequence.
     * Present to prepare the API for future glyf / CFF parsing; placeholder
     * implementations should return null when outlines aren't available.
     */
    public readonly getGlyphOutline?: (gid: number) => GlyphOutlineCmd[] | null,
    /**
     * Optional kerning map (left GID -> right GID -> adjustment in font units).
     */
    public readonly kerning?: KerningMap
  ) {}
}
