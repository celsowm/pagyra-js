import type { PagePainter } from "../page-painter.js";
import type { RenderBox, RGBA } from "../types.js";
import type {
  SvgCircleNode,
  SvgDrawableNode,
  SvgEllipseNode,
  SvgGroupNode,
  SvgLineNode,
  SvgNode,
  SvgPoint,
  SvgPolygonNode,
  SvgPolylineNode,
  SvgRectNode,
  SvgRootNode,
  SvgTextNode,
} from "../../svg/types.js";
import { parseColor, clampAlpha } from "../utils/color-utils.js";

interface SvgCustomData {
  root: SvgRootNode;
  intrinsicWidth: number;
  intrinsicHeight: number;
}

interface SvgStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
  fontSize: number;
  fontFamily?: string;
  textAnchor?: "start" | "middle" | "end";
}

interface SvgRenderContext {
  painter: PagePainter;
  mapPoint: (x: number | undefined, y: number | undefined) => { x: number; y: number };
  mapLengthX: (value: number | undefined) => number;
  mapLengthY: (value: number | undefined) => number;
  strokeScale: number;
}

export async function renderSvgBox(painter: PagePainter, box: RenderBox): Promise<void> {
  const svgData = extractSvgCustomData(box);
  if (!svgData) {
    return;
  }

  const { root } = svgData;
  const content = box.contentBox;
  const widthPx = Math.max(content.width, 0);
  const heightPx = Math.max(content.height, 0);
  if (widthPx <= 0 || heightPx <= 0) {
    return;
  }

  const sourceWidth = resolvePositive(root.viewBox?.width ?? svgData.intrinsicWidth ?? widthPx);
  const sourceHeight = resolvePositive(root.viewBox?.height ?? svgData.intrinsicHeight ?? heightPx);
  const minX = root.viewBox?.minX ?? 0;
  const minY = root.viewBox?.minY ?? 0;

  const scaleX = safeScale(widthPx / sourceWidth);
  const scaleY = safeScale(heightPx / sourceHeight);
  const strokeScale = resolveStrokeScale(scaleX, scaleY);

  const mapPoint = (ux: number | undefined, uy: number | undefined) => {
    const x = ux ?? 0;
    const y = uy ?? 0;
    return {
      x: content.x + (x - minX) * scaleX,
      y: content.y + (y - minY) * scaleY,
    };
  };

  const mapLengthX = (value: number | undefined) => {
    if (!Number.isFinite(value ?? NaN)) {
      return 0;
    }
    return Math.abs(value ?? 0) * Math.abs(scaleX);
  };

  const mapLengthY = (value: number | undefined) => {
    if (!Number.isFinite(value ?? NaN)) {
      return 0;
    }
    return Math.abs(value ?? 0) * Math.abs(scaleY);
  };

  const context: SvgRenderContext = {
    painter,
    mapPoint,
    mapLengthX,
    mapLengthY,
    strokeScale,
  };

  const baseStyle = createDefaultStyle();
  await renderNode(root, baseStyle, context);
}

function extractSvgCustomData(box: RenderBox): SvgCustomData | null {
  const raw = box.customData?.svg;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const candidate = raw as Partial<SvgCustomData>;
  if (!candidate.root) {
    return null;
  }
  return {
    root: candidate.root,
    intrinsicWidth: resolvePositive(candidate.intrinsicWidth ?? 0),
    intrinsicHeight: resolvePositive(candidate.intrinsicHeight ?? 0),
  };
}

async function renderNode(node: SvgNode, style: SvgStyle, context: SvgRenderContext): Promise<void> {
  switch (node.type) {
    case "svg":
    case "g": {
      const nextStyle = deriveStyle(style, node);
      for (const child of node.children) {
        await renderNode(child, nextStyle, context);
      }
      return;
    }
    case "rect":
      return renderRect(node, deriveStyle(style, node), context);
    case "circle":
      return renderCircle(node, deriveStyle(style, node), context);
    case "ellipse":
      return renderEllipse(node, deriveStyle(style, node), context);
    case "polygon":
      return renderPolygon(node, deriveStyle(style, node), context);
    case "polyline":
      return renderPolyline(node, deriveStyle(style, node), context);
    case "line":
      return renderLine(node, deriveStyle(style, node), context);
    case "text":
      return renderText(node, deriveStyle(style, node), context);
    case "path":
      // TODO: Implement path rendering
      return;
    default:
      return;
  }
}

function renderRect(node: SvgRectNode, style: SvgStyle, context: SvgRenderContext): void {
  const width = context.mapLengthX(node.width ?? 0);
  const height = context.mapLengthY(node.height ?? 0);
  if (width <= 0 || height <= 0) {
    return;
  }
  const origin = context.mapPoint(node.x ?? 0, node.y ?? 0);
  const rx = node.rx ?? node.ry ?? 0;
  const ry = node.ry ?? node.rx ?? 0;
  const radius = {
    topLeft: { x: context.mapLengthX(rx), y: context.mapLengthY(ry) },
    topRight: { x: context.mapLengthX(rx), y: context.mapLengthY(ry) },
    bottomRight: { x: context.mapLengthX(rx), y: context.mapLengthY(ry) },
    bottomLeft: { x: context.mapLengthX(rx), y: context.mapLengthY(ry) },
  };
  const rect = {
    x: origin.x,
    y: origin.y,
    width,
    height,
  };

  const fillColor = resolvePaint(style.fill, style.opacity * style.fillOpacity);
  if (fillColor) {
    context.painter.fillRoundedRect(rect, radius, fillColor);
  }

  const strokeColor = resolvePaint(style.stroke, style.opacity * style.strokeOpacity);
  if (strokeColor) {
    const strokeWidthPx = (style.strokeWidth ?? 1) * context.strokeScale;
    context.painter.strokeRoundedRect(rect, radius, strokeColor, strokeWidthPx);
  }
}

function renderCircle(node: SvgCircleNode, style: SvgStyle, context: SvgRenderContext): void {
  const radius = node.r ?? 0;
  if (radius <= 0) {
    return;
  }
  const center = context.mapPoint(node.cx ?? 0, node.cy ?? 0);
  const width = context.mapLengthX(radius * 2);
  const height = context.mapLengthY(radius * 2);
  const rect = {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  };
  const corner = {
    x: width / 2,
    y: height / 2,
  };
  const radii = {
    topLeft: corner,
    topRight: corner,
    bottomRight: corner,
    bottomLeft: corner,
  };

  const fillColor = resolvePaint(style.fill, style.opacity * style.fillOpacity);
  if (fillColor) {
    context.painter.fillRoundedRect(rect, radii, fillColor);
  }

  const strokeColor = resolvePaint(style.stroke, style.opacity * style.strokeOpacity);
  if (strokeColor) {
    const strokeWidthPx = (style.strokeWidth ?? 1) * context.strokeScale;
    context.painter.strokeRoundedRect(rect, radii, strokeColor, strokeWidthPx);
  }
}

function renderEllipse(node: SvgEllipseNode, style: SvgStyle, context: SvgRenderContext): void {
  const rx = node.rx ?? 0;
  const ry = node.ry ?? 0;
  if (rx <= 0 || ry <= 0) {
    return;
  }
  const center = context.mapPoint(node.cx ?? 0, node.cy ?? 0);
  const width = context.mapLengthX(rx * 2);
  const height = context.mapLengthY(ry * 2);
  const rect = {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  };
  const radii = {
    topLeft: { x: width / 2, y: height / 2 },
    topRight: { x: width / 2, y: height / 2 },
    bottomRight: { x: width / 2, y: height / 2 },
    bottomLeft: { x: width / 2, y: height / 2 },
  };

  const fillColor = resolvePaint(style.fill, style.opacity * style.fillOpacity);
  if (fillColor) {
    context.painter.fillRoundedRect(rect, radii, fillColor);
  }

  const strokeColor = resolvePaint(style.stroke, style.opacity * style.strokeOpacity);
  if (strokeColor) {
    const strokeWidthPx = (style.strokeWidth ?? 1) * context.strokeScale;
    context.painter.strokeRoundedRect(rect, radii, strokeColor, strokeWidthPx);
  }
}

function renderPolygon(node: SvgPolygonNode, style: SvgStyle, context: SvgRenderContext): void {
  const points = node.points ?? [];
  if (points.length < 2) {
    return;
  }
  const mapped = mapPoints(points, context);
  const fillColor = resolvePaint(style.fill, style.opacity * style.fillOpacity);
  if (fillColor) {
    context.painter.fillPolygon(mapped, fillColor, true);
  }
  const strokeColor = resolvePaint(style.stroke, style.opacity * style.strokeOpacity);
  if (strokeColor) {
    const strokeWidthPx = (style.strokeWidth ?? 1) * context.strokeScale;
    context.painter.strokePolyline(mapped, strokeColor, {
      lineWidth: strokeWidthPx,
      lineJoin: style.strokeLinejoin,
      close: true,
    });
  }
}

function renderPolyline(node: SvgPolylineNode, style: SvgStyle, context: SvgRenderContext): void {
  const points = node.points ?? [];
  if (points.length < 2) {
    return;
  }
  const mapped = mapPoints(points, context);
  const strokeColor = resolvePaint(style.stroke, style.opacity * style.strokeOpacity);
  if (strokeColor) {
    const strokeWidthPx = (style.strokeWidth ?? 1) * context.strokeScale;
    context.painter.strokePolyline(mapped, strokeColor, {
      lineWidth: strokeWidthPx,
      lineJoin: style.strokeLinejoin,
      lineCap: style.strokeLinecap,
      close: false,
    });
  }
}

function renderLine(node: SvgLineNode, style: SvgStyle, context: SvgRenderContext): void {
  const strokeColor = resolvePaint(style.stroke, style.opacity * style.strokeOpacity);
  if (!strokeColor) {
    return;
  }
  const points = [
    context.mapPoint(node.x1 ?? 0, node.y1 ?? 0),
    context.mapPoint(node.x2 ?? 0, node.y2 ?? 0),
  ];
  const strokeWidthPx = (style.strokeWidth ?? 1) * context.strokeScale;
  context.painter.strokePolyline(points, strokeColor, {
    lineWidth: strokeWidthPx,
    lineCap: style.strokeLinecap,
    close: false,
  });
}

async function renderText(node: SvgTextNode, style: SvgStyle, context: SvgRenderContext): Promise<void> {
  const fillColor = resolvePaint(style.fill, style.opacity * style.fillOpacity);
  if (!fillColor) {
    return;
  }
  const fontSize = node.fontSize ?? style.fontSize;
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    return;
  }
  const anchor = node.textAnchor ?? style.textAnchor ?? "start";
  const baselinePoint = context.mapPoint(node.x ?? 0, node.y ?? 0);
  let textX = baselinePoint.x;
  const approxWidth = estimateTextWidth(node.text, fontSize);
  if (anchor === "middle") {
    textX -= approxWidth / 2;
  } else if (anchor === "end") {
    textX -= approxWidth;
  }
  const fontSizePt = context.painter.convertPxToPt(fontSize);
  const color: RGBA = { r: fillColor.r, g: fillColor.g, b: fillColor.b, a: clampAlpha(fillColor.a ?? 1) };
  await context.painter.drawText(node.text, textX, baselinePoint.y, {
    fontSizePt,
    fontFamily: node.fontFamily ?? style.fontFamily,
    color,
  });
}

function mapPoints(points: readonly SvgPoint[], context: SvgRenderContext): { x: number; y: number }[] {
  return points.map((point) => context.mapPoint(point.x, point.y));
}

function deriveStyle(base: SvgStyle, node: SvgDrawableNode | SvgGroupNode | SvgRootNode): SvgStyle {
  const style: SvgStyle = { ...base };
  const attrs = node.attributes ?? {};

  if (attrs.opacity !== undefined) {
    const value = parseOpacity(attrs.opacity);
    if (value !== undefined) {
      style.opacity = clamp01(style.opacity * value);
    }
  }

  if (attrs.fill !== undefined) {
    const fillValue = attrs.fill.trim();
    style.fill = !fillValue || fillValue === "none" ? undefined : fillValue;
  }

  if (attrs["fill-opacity"] !== undefined) {
    const value = parseOpacity(attrs["fill-opacity"]);
    if (value !== undefined) {
      style.fillOpacity = clamp01(value);
    }
  }

  if (attrs.stroke !== undefined) {
    const strokeValue = attrs.stroke.trim();
    style.stroke = !strokeValue || strokeValue === "none" ? undefined : strokeValue;
  }

  if (attrs["stroke-opacity"] !== undefined) {
    const value = parseOpacity(attrs["stroke-opacity"]);
    if (value !== undefined) {
      style.strokeOpacity = clamp01(value);
    }
  }

  if (attrs["stroke-width"] !== undefined) {
    const value = parseNumber(attrs["stroke-width"]);
    if (value !== undefined) {
      style.strokeWidth = value;
    }
  }

  if (attrs["stroke-linecap"] !== undefined) {
    const cap = normalizeLineCap(attrs["stroke-linecap"]);
    if (cap) {
      style.strokeLinecap = cap;
    }
  }

  if (attrs["stroke-linejoin"] !== undefined) {
    const join = normalizeLineJoin(attrs["stroke-linejoin"]);
    if (join) {
      style.strokeLinejoin = join;
    }
  }

  if (attrs["font-size"] !== undefined) {
    const value = parseNumber(attrs["font-size"]);
    if (value !== undefined) {
      style.fontSize = value;
    }
  }

  if (attrs["font-family"] !== undefined) {
    const family = attrs["font-family"].trim();
    if (family) {
      style.fontFamily = family;
    }
  }

  if (attrs["text-anchor"] !== undefined) {
    const anchor = normalizeTextAnchor(attrs["text-anchor"]);
    if (anchor) {
      style.textAnchor = anchor;
    }
  }

  return style;
}

function createDefaultStyle(): SvgStyle {
  return {
    fill: "#000000",
    stroke: undefined,
    strokeWidth: 1,
    strokeLinecap: "butt",
    strokeLinejoin: "miter",
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
    fontSize: 16,
    fontFamily: undefined,
    textAnchor: "start",
  };
}

function resolvePaint(value: string | undefined, opacity: number): RGBA | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "none") {
    return undefined;
  }
  const color = parseColor(value);
  if (!color) {
    return undefined;
  }
  const baseAlpha = color.a ?? 1;
  return {
    r: color.r,
    g: color.g,
    b: color.b,
    a: clamp01(baseAlpha * opacity),
  };
}

function parseOpacity(value: string | undefined): number | undefined {
  const parsed = parseNumber(value);
  if (parsed === undefined) {
    return undefined;
  }
  return clamp01(parsed);
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num)) {
    return undefined;
  }
  return num;
}

function normalizeLineCap(value: string): "butt" | "round" | "square" | undefined {
  const lower = value.trim().toLowerCase();
  if (lower === "butt" || lower === "round" || lower === "square") {
    return lower;
  }
  return undefined;
}

function normalizeLineJoin(value: string): "miter" | "round" | "bevel" | undefined {
  const lower = value.trim().toLowerCase();
  if (lower === "miter" || lower === "round" || lower === "bevel") {
    return lower;
  }
  return undefined;
}

function normalizeTextAnchor(value: string): "start" | "middle" | "end" | undefined {
  const lower = value.trim().toLowerCase();
  if (lower === "start" || lower === "middle" || lower === "end") {
    return lower;
  }
  return undefined;
}

function resolveStrokeScale(scaleX: number, scaleY: number): number {
  const product = Math.abs(scaleX * scaleY);
  if (product > 0) {
    return Math.sqrt(product);
  }
  const average = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
  return average > 0 ? average : 1;
}

function safeScale(value: number): number {
  if (!Number.isFinite(value) || value === 0) {
    return 1;
  }
  return value;
}

function resolvePositive(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return value;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function estimateTextWidth(text: string, fontSize: number): number {
  if (!text) {
    return 0;
  }
  const averageFactor = 0.6;
  return text.length * fontSize * averageFactor;
}
