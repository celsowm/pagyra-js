import type { BackgroundRepeat, Gradient } from "../css/background-types.js";
import type { GlyphRun } from "../layout/text-run.js";

export enum NodeKind {
  Container = "container",
  TextRuns = "text-runs",
  Image = "image",
  Svg = "svg",
  ListItem = "list-item",
  Table = "table",
  Hr = "hr",
  Float = "float",
  Absolute = "absolute",
  Fixed = "fixed",
  Sticky = "sticky",
  FlexContainer = "flex-container",
  GridContainer = "grid-container",
  MulticolContainer = "multicol-container",
  Caption = "caption",
  ColGroup = "colgroup",
  Col = "col",
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Edges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type BorderStyle = "none" | "solid" | "dashed" | "dotted" | "double";

export interface BorderStyles {
  top: BorderStyle;
  right: BorderStyle;
  bottom: BorderStyle;
  left: BorderStyle;
}

export interface CornerRadius {
  x: number;
  y: number;
}

export interface Radius {
  topLeft: CornerRadius;
  topRight: CornerRadius;
  bottomRight: CornerRadius;
  bottomLeft: CornerRadius;
}

export interface BackgroundImage {
  image: ImageRef;
  rect: Rect;
  repeat: BackgroundRepeat;
  originRect: Rect;
}

export interface GradientBackground {
  gradient: Gradient;
  rect: Rect;
  repeat: BackgroundRepeat;
  originRect: Rect;
}

export interface Background {
  color?: RGBA;
  image?: BackgroundImage;
  gradient?: GradientBackground;
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ShapePoint {
  x: number;
  y: number;
}

export interface ShadowLayer {
  inset: boolean;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: RGBA;
}

export interface TextShadowLayer extends ShadowLayer { }

export enum Overflow {
  Visible = "visible",
  Hidden = "hidden",
  Auto = "auto",
  Scroll = "scroll",
  Clip = "clip",
}

export interface ImageRef {
  src: string;
  width: number;
  height: number;
  format: "jpeg" | "png" | "gif" | "webp";
  channels: number;
  bitsPerComponent: number;
  data: ArrayBuffer;
}

export enum ObjectFit {
  Fill = "fill",
  Contain = "contain",
  Cover = "cover",
  None = "none",
  ScaleDown = "scale-down",
}

export interface Marker {
  text?: string;
  counter?: number;
}

export interface Decorations {
  underline?: boolean;
  overline?: boolean;
  lineThrough?: boolean;
  style?: "solid" | "double" | "dotted" | "dashed" | "wavy";
  color?: RGBA;
}

export interface Link {
  rect: Rect;
  target: { uri?: string; dest?: string };
}

export interface Run {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  fontStyle?: string;
  fontVariant?: string;
  fill: RGBA;
  lineMatrix: TextMatrix;
  letterSpacing?: number;
  glyphs?: GlyphRun;
  wordSpacing?: number;
  decorations?: Decorations;
  advanceWidth?: number;
  textGradient?: GradientBackground;
  textShadows?: TextShadowLayer[];

  // --- Justification metadata (inlineRuns path only) ---

  /**
   * Line index in the block (0-based).
   * Only set for runs coming from LayoutNode.inlineRuns.
   */
  lineIndex?: number;

  /**
   * True if this run is on the last visual line of its block.
   */
  isLastLine?: boolean;

  /**
   * Number of spaces *inside this run* that participate in justification.
   * This is used to compute how much extra width this run contributes
   * when wordSpacing is applied.
   */
  spacesInRun?: number;
}

export interface StrokeDash {
  pattern: number[];
  phase?: number;
}

export interface TextMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

// GlyphRun is now imported from ../layout/text-run.js

export interface TableModel {
  mode: "separate" | "collapse";
  rows: TableRow[];
  collapsedGrid?: unknown;
}

export interface TableRow {
  cells: TableCell[];
}

export interface TableCell {
  content: RenderBox[];
  background?: Background;
  border?: Edges;
  contentClip?: Rect;
}

export interface MultiColModel {
  columnWidth: number;
  gap: number;
  count: number;
  balance: boolean;
  columnRule?: unknown;
}

export interface Positioning {
  type: "normal" | "float" | "absolute" | "fixed" | "sticky";
}

export interface LayoutPageTree {
  paintOrder: RenderBox[];
  floatLayerOrder: RenderBox[];
  flowContentOrder: RenderBox[];
  positionedLayersSortedByZ: PositionedLayer[];
  decorations: DecorationCommand[];
  links: Link[];
  pageOffsetY: number;
}

export interface PositionedLayer {
  z: number;
  boxes: RenderBox[];
}

export interface DecorationCommand {
  type: "underline" | "overline" | "line-through";
  rect: Rect;
  color: RGBA;
}

export interface RenderBox {
  tagName?: string;
  textContent?: string;
  id: string;
  kind: NodeKind;
  contentBox: Rect;
  paddingBox: Rect;
  borderBox: Rect;
  visualOverflow: Rect;
  padding: Edges;
  border: Edges;
  borderRadius: Radius;
  background: Background;
  opacity: number;
  overflow: Overflow;
  textRuns: Run[];
  decorations: Decorations;
  textShadows: TextShadowLayer[];
  image?: ImageRef;
  objectFit?: ObjectFit;
  marker?: Marker;
  markerRect?: Rect;
  tableModel?: TableModel;
  tableCaption?: RenderBox | null;
  colgroups?: RenderBox[];
  cols?: RenderBox[];
  multicol?: MultiColModel;
  boxShadows: ShadowLayer[];
  establishesStackingContext: boolean;
  zIndexComputed: number;
  positioning: Positioning;
  containingBlockForAbs?: RenderBox | null;
  children: RenderBox[];
  links: Link[];
  customData?: Record<string, unknown>;
  borderColor?: RGBA;
  borderStyle?: BorderStyles;
  color?: RGBA;
  transform?: TextMatrix;

  /**
   * Normalized text alignment of this box (from CSS text-align).
   * Only the visual modes are captured here.
   */
  textAlign?: "left" | "center" | "right" | "justify";
}

export interface LayoutTree {
  root: RenderBox;
  dpiAssumption: number;
  css: StyleSheets;
  hf: HeaderFooterHTML;
}

export interface StyleSheets {
  fontFaces: CSSFontFace[];
}

export interface CSSFontFace {
  family: string;
  weight?: string | number;
  style?: string;
  stretch?: string;
  src: string[];
  ranges?: Array<[number, number]>;
  featurePolicies?: Record<string, unknown>;
}

export interface HeaderFooterHTML {
  headerHtml?: HtmlDocument;
  footerHtml?: HtmlDocument;
  headerFirstHtml?: HtmlDocument;
  footerFirstHtml?: HtmlDocument;
  headerEvenHtml?: HtmlDocument;
  footerEvenHtml?: HtmlDocument;
  headerOddHtml?: HtmlDocument;
  footerOddHtml?: HtmlDocument;
  placeholders: Record<string, string | ((index: number, total: number) => string)>;
  layerMode: LayerMode;
  maxHeaderHeightPx: number;
  maxFooterHeightPx: number;
  clipOverflow: boolean;
  fontFamily?: string;
}

export type HtmlDocument = unknown;

export enum LayerMode {
  Under = "under",
  Over = "over",
}

export interface TextPaintOptions {
  readonly fontSizePt: number;
  readonly color?: RGBA;
  readonly align?: "left" | "center" | "right";
  readonly fontFamily?: string;
  readonly fontWeight?: number;
  readonly fontStyle?: string;
  readonly fontVariant?: string;
  readonly absolute?: boolean;
}

export interface StrokeOptions {
  lineWidth?: number;
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "miter" | "round" | "bevel";
  dash?: StrokeDash;
}

export interface PageSize {
  widthPt: number;
  heightPt: number;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  producer?: string;
}
