import type { Matrix } from "../pdf/svg/matrix-utils.js";

export type SvgNodeType =
  | "svg"
  | "g"
  | "defs"
  | "rect"
  | "circle"
  | "ellipse"
  | "line"
  | "path"
  | "polyline"
  | "polygon"
  | "text"
  | "image"
  | "use"
  | "clippath"
  | "lineargradient"
  | "radialgradient";

export interface SvgCommon {
  type: SvgNodeType;
  id?: string;
  classes: string[];
  attributes: Record<string, string>;
  transform?: string;
  transformMatrix?: Matrix;
}

export interface SvgContainerNode extends SvgCommon {
  type: "svg" | "g" | "clippath" | "defs";
  children: SvgNode[];
}

export interface SvgDefsNode extends SvgContainerNode {
  type: "defs";
}

export interface SvgRootNode extends SvgContainerNode {
  type: "svg";
  width?: number;
  height?: number;
  viewBox?: SvgViewBox;
}

export interface SvgGroupNode extends SvgContainerNode {
  type: "g";
}

export interface SvgRectNode extends SvgCommon {
  type: "rect";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rx?: number;
  ry?: number;
}

export interface SvgCircleNode extends SvgCommon {
  type: "circle";
  cx?: number;
  cy?: number;
  r?: number;
}

export interface SvgEllipseNode extends SvgCommon {
  type: "ellipse";
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
}

export interface SvgLineNode extends SvgCommon {
  type: "line";
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface SvgPathNode extends SvgCommon {
  type: "path";
  d?: string;
}

export interface SvgPolylineNode extends SvgCommon {
  type: "polyline";
  points?: readonly SvgPoint[];
}

export interface SvgPolygonNode extends SvgCommon {
  type: "polygon";
  points?: readonly SvgPoint[];
}

export interface SvgTextNode extends SvgCommon {
  type: "text";
  x?: number;
  y?: number;
  text: string;
  fontSize?: number;
  fontFamily?: string;
  textAnchor?: "start" | "middle" | "end";
}

export interface SvgImageNode extends SvgCommon {
  type: "image";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  href?: string;
  preserveAspectRatio?: string;
}

export interface SvgUseNode extends SvgCommon {
  type: "use";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  href?: string;
}

export interface SvgClipPathNode extends SvgContainerNode {
  type: "clippath";
  clipPathUnits?: "userSpaceOnUse" | "objectBoundingBox";
}

export interface SvgGradientStop {
  offset: number;
  color: string;
  opacity?: number;
}

export interface SvgLinearGradientNode extends SvgCommon {
  type: "lineargradient";
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  gradientUnits?: "userSpaceOnUse" | "objectBoundingBox";
  spreadMethod?: "pad" | "reflect" | "repeat";
  stops: SvgGradientStop[];
}

export interface SvgRadialGradientNode extends SvgCommon {
  type: "radialgradient";
  cx?: number;
  cy?: number;
  r?: number;
  fx?: number;
  fy?: number;
  gradientUnits?: "userSpaceOnUse" | "objectBoundingBox";
  spreadMethod?: "pad" | "reflect" | "repeat";
  stops: SvgGradientStop[];
}

export interface SvgPoint {
  x: number;
  y: number;
}

export interface SvgViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export type SvgShapeNode =
  | SvgRectNode
  | SvgCircleNode
  | SvgEllipseNode
  | SvgLineNode
  | SvgPathNode
  | SvgPolylineNode
  | SvgPolygonNode;

export type SvgNode =
  | SvgRootNode
  | SvgGroupNode
  | SvgShapeNode
  | SvgTextNode
  | SvgImageNode
  | SvgUseNode
  | SvgClipPathNode
  | SvgDefsNode
  | SvgLinearGradientNode
  | SvgRadialGradientNode;

export type SvgDrawableNode = SvgShapeNode | SvgTextNode | SvgImageNode;
