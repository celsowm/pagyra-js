import type {
  SvgCircleNode,
  SvgEllipseNode,
  SvgLineNode,
  SvgPathNode,
  SvgPolygonNode,
  SvgPolylineNode,
  SvgRectNode,
  SvgTextNode,
} from "../../svg/types.js";
import type { SvgRenderContext } from "./render-svg.js";
import type { SvgStyle } from "./style-computer.js";
import type { PathCommand } from "../renderers/shape-renderer.js";
import { parsePathData } from "../../svg/path-data.js";
import { buildEllipseSegments, buildRectSegments, buildRoundedRectSegments } from "./geometry-builder.js";
import { mapPathSegments, mapPoints, mapSvgPoint } from "./coordinate-mapper.js";
import { resolvePaint } from "./style-computer.js";
import { clampAlpha } from "../utils/color-utils.js";
import { applyMatrixToPoint, multiplyMatrices } from "./matrix-utils.js";

export function renderRect(node: SvgRectNode, style: SvgStyle, context: SvgRenderContext): void {
  const width = Number.isFinite(node.width ?? NaN) ? node.width ?? 0 : 0;
  const height = Number.isFinite(node.height ?? NaN) ? node.height ?? 0 : 0;
  if (width <= 0 || height <= 0) {
    return;
  }
  const x = Number.isFinite(node.x ?? NaN) ? node.x ?? 0 : 0;
  const y = Number.isFinite(node.y ?? NaN) ? node.y ?? 0 : 0;

  let rx = node.rx ?? node.ry ?? 0;
  let ry = node.ry ?? node.rx ?? 0;
  if (!Number.isFinite(rx)) rx = 0;
  if (!Number.isFinite(ry)) ry = 0;
  rx = clampRadius(rx, width / 2);
  ry = clampRadius(ry, height / 2);

  const segments = rx > 0 || ry > 0 ? buildRoundedRectSegments(x, y, width, height, rx, ry) : buildRectSegments(x, y, width, height);
  const commands = mapPathSegments(segments, context);
  if (!commands || commands.length === 0) {
    return;
  }
  paintPathCommands(commands, style, context, style.fillRule);
}

export function renderCircle(node: SvgCircleNode, style: SvgStyle, context: SvgRenderContext): void {
  const radius = Number.isFinite(node.r ?? NaN) ? node.r ?? 0 : 0;
  if (radius <= 0) {
    return;
  }
  const cx = Number.isFinite(node.cx ?? NaN) ? node.cx ?? 0 : 0;
  const cy = Number.isFinite(node.cy ?? NaN) ? node.cy ?? 0 : 0;
  const segments = buildEllipseSegments(cx, cy, radius, radius);
  const commands = mapPathSegments(segments, context);
  if (!commands || commands.length === 0) {
    return;
  }
  paintPathCommands(commands, style, context, style.fillRule);
}

export function renderEllipse(node: SvgEllipseNode, style: SvgStyle, context: SvgRenderContext): void {
  const rx = Number.isFinite(node.rx ?? NaN) ? node.rx ?? 0 : 0;
  const ry = Number.isFinite(node.ry ?? NaN) ? node.ry ?? 0 : 0;
  if (rx <= 0 || ry <= 0) {
    return;
  }
  const cx = Number.isFinite(node.cx ?? NaN) ? node.cx ?? 0 : 0;
  const cy = Number.isFinite(node.cy ?? NaN) ? node.cy ?? 0 : 0;
  const segments = buildEllipseSegments(cx, cy, rx, ry);
  const commands = mapPathSegments(segments, context);
  if (!commands || commands.length === 0) {
    return;
  }
  paintPathCommands(commands, style, context, style.fillRule);
}

function clampRadius(value: number, limit: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (value > limit) {
    return limit;
  }
  return value;
}

export function renderPolygon(node: SvgPolygonNode, style: SvgStyle, context: SvgRenderContext): void {
  const points = node.points ?? [];
  if (points.length < 2) {
    return;
  }
  const mapped = mapPoints(points, context);
  if (mapped.length < 2) {
    return;
  }
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

export function renderPolyline(node: SvgPolylineNode, style: SvgStyle, context: SvgRenderContext): void {
  const points = node.points ?? [];
  if (points.length < 2) {
    return;
  }
  const mapped = mapPoints(points, context);
  if (mapped.length < 2) {
    return;
  }
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

export function renderLine(node: SvgLineNode, style: SvgStyle, context: SvgRenderContext): void {
  const strokeColor = resolvePaint(style.stroke, style.opacity * style.strokeOpacity);
  if (!strokeColor) {
    return;
  }
  const start = mapSvgPoint(node.x1 ?? 0, node.y1 ?? 0, context);
  const end = mapSvgPoint(node.x2 ?? 0, node.y2 ?? 0, context);
  if (!start || !end) {
    return;
  }
  const points = [start, end];
  const strokeWidthPx = (style.strokeWidth ?? 1) * context.strokeScale;
  context.painter.strokePolyline(points, strokeColor, {
    lineWidth: strokeWidthPx,
    lineCap: style.strokeLinecap,
    close: false,
  });
}

export function renderPath(node: SvgPathNode, style: SvgStyle, context: SvgRenderContext): void {
  const segments = parsePathData(node.d);
  if (segments.length === 0) {
    return;
  }
  const commands = mapPathSegments(segments, context);
  if (!commands || commands.length === 0) {
    return;
  }
  paintPathCommands(commands, style, context, style.fillRule);
}

function paintPathCommands(commands: PathCommand[], style: SvgStyle, context: SvgRenderContext, fillRule?: "nonzero" | "evenodd"): void {
  if (commands.length === 0) {
    return;
  }
  const fillColor = resolvePaint(style.fill, style.opacity * style.fillOpacity);
  if (fillColor) {
    context.painter.fillPath(commands, fillColor, { fillRule: fillRule ?? style.fillRule });
  }
  const strokeColor = resolvePaint(style.stroke, style.opacity * style.strokeOpacity);
  if (strokeColor) {
    const strokeWidthPx = (style.strokeWidth ?? 1) * context.strokeScale;
    const strokeOptions = {
      lineWidth: strokeWidthPx > 0 ? strokeWidthPx : undefined,
      lineCap: style.strokeLinecap,
      lineJoin: style.strokeLinejoin,
    };
    context.painter.strokePath(commands, strokeColor, strokeOptions);
  }
}

export async function renderText(node: SvgTextNode, style: SvgStyle, context: SvgRenderContext): Promise<void> {
  const fillColor = resolvePaint(style.fill, style.opacity * style.fillOpacity);
  if (!fillColor) {
    return;
  }
  const fontSize = node.fontSize ?? style.fontSize;
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    return;
  }
  const anchor = node.textAnchor ?? style.textAnchor ?? "start";
  const combined = multiplyMatrices(context.viewportMatrix, context.transform);
  const anchorX = Number.isFinite(node.x ?? NaN) ? node.x ?? 0 : 0;
  const anchorY = Number.isFinite(node.y ?? NaN) ? node.y ?? 0 : 0;
  const origin = applyMatrixToPoint(combined, anchorX, anchorY);

  const axisX = { x: combined.a, y: combined.b };
  const approxWidth = estimateTextWidth(node.text, fontSize);
  const anchorFactor = anchor === "middle" ? 0.5 : anchor === "end" ? 1 : 0;
  let baselineX = origin.x;
  let baselineY = origin.y;
  if (anchorFactor !== 0 && (axisX.x !== 0 || axisX.y !== 0)) {
    baselineX -= axisX.x * approxWidth * anchorFactor;
    baselineY -= axisX.y * approxWidth * anchorFactor;
  }

  const color = { r: fillColor.r, g: fillColor.g, b: fillColor.b, a: clampAlpha(fillColor.a ?? 1) };
  const fontFamily = node.fontFamily ?? style.fontFamily ?? "Helvetica";
  await context.painter.drawTextRun({
    text: node.text,
    fontFamily,
    fontSize,
    fill: color,
    lineMatrix: {
      a: combined.a,
      b: combined.b,
      c: combined.c,
      d: combined.d,
      e: baselineX,
      f: baselineY,
    },
  });
}

function estimateTextWidth(text: string, fontSize: number): number {
  if (!text) {
    return 0;
  }
  const averageFactor = 0.6;
  return text.length * fontSize * averageFactor;
}
