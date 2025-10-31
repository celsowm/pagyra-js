export type SvgNodeType =
  | "svg"
  | "g"
  | "rect"
  | "circle"
  | "ellipse"
  | "line"
  | "path"
  | "polyline"
  | "polygon"
  | "text";

export interface SvgCommon {
  type: SvgNodeType;
  id?: string;
  classes: string[];
  attributes: Record<string, string>;
  transform?: string;
}

export interface SvgContainerNode extends SvgCommon {
  type: "svg" | "g";
  children: SvgNode[];
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

export type SvgNode = SvgRootNode | SvgGroupNode | SvgShapeNode | SvgTextNode;

export type SvgDrawableNode = SvgShapeNode | SvgTextNode;
