export { LayoutNode } from "./dom/node.js";
export type { NodeVisitor } from "./dom/node.js";

export { ComputedStyle } from "./css/style.js";
export type { StyleProperties, FlexDirection, GridAutoFlow, AlignSelfValue, TrackDefinition } from "./css/style.js";

export * from "./css/enums.js";

export type { Viewport, ContainingBlock } from "./geometry/box.js";
export { Box } from "./geometry/box.js";

export { LayoutEngine } from "./layout/pipeline/engine.js";
export { createDefaultLayoutEngine } from "./layout/pipeline/default-engine.js";
export { layoutTree } from "./layout/pipeline/layout-tree.js";
export { renderPdf } from "./pdf/render.js";
export { buildRenderTree } from "./pdf/layout-tree-builder.js";
export type { RenderPdfOptions } from "./pdf/render.js";
export type { LayoutTree as PdfLayoutTree } from "./pdf/types.js";

// PDF Types - Header/Footer & Rendering
export { LayerMode } from "./pdf/types.js";
export type {
  HeaderFooterHTML,
  PageSize,
  PdfMetadata,
  Overflow,
  ObjectFit,
  RGBA,
  Rect,
  Edges,
  BorderStyle,
  BorderStyles,
  CornerRadius,
  Radius,
  ClipPath,
  Background,
  BackgroundImage,
  GradientBackground,
  ShapePoint,
  ShadowLayer,
  ImageRef,
  Marker,
  Decorations,
  Link,
  Run,
  StrokeDash,
  TextMatrix,
  TableModel,
  TableRow,
  TableCell,
  MultiColModel,
  Positioning,
  LayoutPageTree,
  PositionedLayer,
  DecorationCommand,
  RenderBox,
  StyleSheets,
  CSSFontFace,
  HtmlDocument,
  TextPaintOptions,
  StrokeOptions,
} from "./pdf/types.js";

export type { PageMargins } from "./pdf/render.js";
