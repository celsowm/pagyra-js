export enum NodeKind {
  Container = "container",
  TextRuns = "text-runs",
  Image = "image",
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

export interface Radius {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface Background {
  color?: RGBA;
  image?: unknown;
  gradient?: unknown;
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ShadowLayer {
  inset: boolean;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: RGBA;
}

export interface TextShadowLayer extends ShadowLayer {}

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
  data?: ArrayBuffer;
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
  fill: RGBA;
  lineMatrix: TextMatrix;
  glyphs?: GlyphRun;
  wordSpacing?: number;
}

export interface TextMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface GlyphRun {
  glyphIds: number[];
  advances: number[];
  positions: Array<{ x: number; y: number }>;
}

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
  color?: RGBA;
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
