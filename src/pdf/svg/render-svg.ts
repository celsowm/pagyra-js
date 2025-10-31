import type { PagePainter } from "../page-painter.js";
import type { RenderBox, RGBA } from "../types.js";
import type { PathCommand } from "../renderers/shape-renderer.js";
import type {
  SvgCircleNode,
  SvgDrawableNode,
  SvgEllipseNode,
  SvgGroupNode,
  SvgLineNode,
  SvgNode,
  SvgPathNode,
  SvgPoint,
  SvgPolygonNode,
  SvgPolylineNode,
  SvgRectNode,
  SvgRootNode,
  SvgTextNode,
} from "../../svg/types.js";
import { parsePathData, type NormalizedPathCommand } from "../../svg/path-data.js";
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
  fillRule: "nonzero" | "evenodd";
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
  fontSize: number;
  fontFamily?: string;
  textAnchor?: "start" | "middle" | "end";
}

interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

type AspectAlign =
  | "none"
  | "xMinYMin"
  | "xMidYMin"
  | "xMaxYMin"
  | "xMinYMid"
  | "xMidYMid"
  | "xMaxYMid"
  | "xMinYMax"
  | "xMidYMax"
  | "xMaxYMax";

interface PreserveAspectRatioConfig {
  align: AspectAlign;
  meetOrSlice: "meet" | "slice";
}

interface SvgRenderContext {
  painter: PagePainter;
  viewportMatrix: Matrix;
  transform: Matrix;
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

  const preserveAttr = root.attributes?.preserveAspectRatio ?? root.attributes?.preserveaspectratio;
  const preserve = parsePreserveAspectRatio(typeof preserveAttr === "string" ? preserveAttr : undefined);

  const baseScaleX = safeScale(widthPx / sourceWidth);
  const baseScaleY = safeScale(heightPx / sourceHeight);

  let scaleX = baseScaleX;
  let scaleY = baseScaleY;
  let offsetX = 0;
  let offsetY = 0;

  if (preserve.align !== "none") {
    const uniformScale = preserve.meetOrSlice === "slice" ? Math.max(baseScaleX, baseScaleY) : Math.min(baseScaleX, baseScaleY);
    scaleX = uniformScale;
    scaleY = uniformScale;
    const scaledWidth = sourceWidth * scaleX;
    const scaledHeight = sourceHeight * scaleY;
    const extraWidth = widthPx - scaledWidth;
    const extraHeight = heightPx - scaledHeight;
    const factors = getAlignFactors(preserve.align);
    offsetX = extraWidth * factors.x;
    offsetY = extraHeight * factors.y;
  }

  const viewportMatrix: Matrix = {
    a: scaleX,
    b: 0,
    c: 0,
    d: scaleY,
    e: content.x + offsetX - minX * scaleX,
    f: content.y + offsetY - minY * scaleY,
  };

  const initialTransform = identityMatrix();
  const strokeScale = computeStrokeScale(viewportMatrix, initialTransform);

  const context: SvgRenderContext = {
    painter,
    viewportMatrix,
    transform: initialTransform,
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
  let workingContext = context;
  const nodeTransform = parseTransform(node.transform);
  if (nodeTransform) {
    const combined = multiplyMatrices(context.transform, nodeTransform);
    workingContext = {
      painter: context.painter,
      viewportMatrix: context.viewportMatrix,
      transform: combined,
      strokeScale: computeStrokeScale(context.viewportMatrix, combined),
    };
  }

  switch (node.type) {
    case "svg":
    case "g": {
      const nextStyle = deriveStyle(style, node);
      for (const child of node.children) {
        await renderNode(child, nextStyle, workingContext);
      }
      return;
    }
    case "rect":
      return renderRect(node, deriveStyle(style, node), workingContext);
    case "circle":
      return renderCircle(node, deriveStyle(style, node), workingContext);
    case "ellipse":
      return renderEllipse(node, deriveStyle(style, node), workingContext);
    case "polygon":
      return renderPolygon(node, deriveStyle(style, node), workingContext);
    case "polyline":
      return renderPolyline(node, deriveStyle(style, node), workingContext);
    case "line":
      return renderLine(node, deriveStyle(style, node), workingContext);
    case "text":
      return renderText(node, deriveStyle(style, node), workingContext);
    case "path":
      return renderPath(node, deriveStyle(style, node), workingContext);
    default:
      return;
  }
}

function renderRect(node: SvgRectNode, style: SvgStyle, context: SvgRenderContext): void {
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

function renderCircle(node: SvgCircleNode, style: SvgStyle, context: SvgRenderContext): void {
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

function renderEllipse(node: SvgEllipseNode, style: SvgStyle, context: SvgRenderContext): void {
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

const CIRCLE_KAPPA = 0.5522847498307936;

function buildRectSegments(x: number, y: number, width: number, height: number): NormalizedPathCommand[] {
  return [
    { type: "M", x, y },
    { type: "L", x: x + width, y },
    { type: "L", x: x + width, y: y + height },
    { type: "L", x, y: y + height },
    { type: "Z" },
  ];
}

function buildRoundedRectSegments(x: number, y: number, width: number, height: number, rx: number, ry: number): NormalizedPathCommand[] {
  const right = x + width;
  const bottom = y + height;
  const kx = rx * CIRCLE_KAPPA;
  const ky = ry * CIRCLE_KAPPA;
  return [
    { type: "M", x: x + rx, y },
    { type: "L", x: right - rx, y },
    { type: "C", x1: right - rx + kx, y1: y, x2: right, y2: y + ry - ky, x: right, y: y + ry },
    { type: "L", x: right, y: bottom - ry },
    { type: "C", x1: right, y1: bottom - ry + ky, x2: right - rx + kx, y2: bottom, x: right - rx, y: bottom },
    { type: "L", x: x + rx, y: bottom },
    { type: "C", x1: x + rx - kx, y1: bottom, x2: x, y2: bottom - ry + ky, x: x, y: bottom - ry },
    { type: "L", x, y: y + ry },
    { type: "C", x1: x, y1: y + ry - ky, x2: x + rx - kx, y2: y, x: x + rx, y },
    { type: "Z" },
  ];
}

function buildEllipseSegments(cx: number, cy: number, rx: number, ry: number): NormalizedPathCommand[] {
  const mx = rx * CIRCLE_KAPPA;
  const my = ry * CIRCLE_KAPPA;
  return [
    { type: "M", x: cx, y: cy - ry },
    { type: "C", x1: cx + mx, y1: cy - ry, x2: cx + rx, y2: cy - my, x: cx + rx, y: cy },
    { type: "C", x1: cx + rx, y1: cy + my, x2: cx + mx, y2: cy + ry, x: cx, y: cy + ry },
    { type: "C", x1: cx - mx, y1: cy + ry, x2: cx - rx, y2: cy + my, x: cx - rx, y: cy },
    { type: "C", x1: cx - rx, y1: cy - my, x2: cx - mx, y2: cy - ry, x: cx, y: cy - ry },
    { type: "Z" },
  ];
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

function renderPolygon(node: SvgPolygonNode, style: SvgStyle, context: SvgRenderContext): void {
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

function renderPolyline(node: SvgPolylineNode, style: SvgStyle, context: SvgRenderContext): void {
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

function renderLine(node: SvgLineNode, style: SvgStyle, context: SvgRenderContext): void {
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

function renderPath(node: SvgPathNode, style: SvgStyle, context: SvgRenderContext): void {
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

  const color: RGBA = { r: fillColor.r, g: fillColor.g, b: fillColor.b, a: clampAlpha(fillColor.a ?? 1) };
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

function mapPoints(points: readonly SvgPoint[], context: SvgRenderContext): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  for (const point of points) {
    const mapped = mapSvgPoint(point.x, point.y, context);
    if (!mapped) {
      return [];
    }
    result.push(mapped);
  }
  return result;
}

function mapPathSegments(segments: readonly NormalizedPathCommand[], context: SvgRenderContext): PathCommand[] | null {
  const commands: PathCommand[] = [];
  for (const segment of segments) {
    switch (segment.type) {
      case "M": {
        const point = mapSvgPoint(segment.x, segment.y, context);
        if (!point) {
          return null;
        }
        commands.push({ type: "moveTo", x: point.x, y: point.y });
        break;
      }
      case "L": {
        const point = mapSvgPoint(segment.x, segment.y, context);
        if (!point) {
          return null;
        }
        commands.push({ type: "lineTo", x: point.x, y: point.y });
        break;
      }
      case "C": {
        const cp1 = mapSvgPoint(segment.x1, segment.y1, context);
        const cp2 = mapSvgPoint(segment.x2, segment.y2, context);
        const end = mapSvgPoint(segment.x, segment.y, context);
        if (!cp1 || !cp2 || !end) {
          return null;
        }
        commands.push({
          type: "curveTo",
          x1: cp1.x,
          y1: cp1.y,
          x2: cp2.x,
          y2: cp2.y,
          x: end.x,
          y: end.y,
        });
        break;
      }
      case "Z":
        commands.push({ type: "closePath" });
        break;
      default:
        return null;
    }
  }
  return commands;
}

function mapSvgPoint(x: number, y: number, context: SvgRenderContext): { x: number; y: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const mapped = mapPointToViewport(context, x, y);
  if (!Number.isFinite(mapped.x) || !Number.isFinite(mapped.y)) {
    return null;
  }
  return mapped;
}

function identityMatrix(): Matrix {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

function multiplyMatrices(m1: Matrix, m2: Matrix): Matrix {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

function applyMatrixToPoint(matrix: Matrix, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function applyMatrixToVector(matrix: Matrix, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y,
    y: matrix.b * x + matrix.d * y,
  };
}

function mapPointToViewport(context: SvgRenderContext, x: number, y: number): { x: number; y: number } {
  const local = applyMatrixToPoint(context.transform, x, y);
  return applyMatrixToPoint(context.viewportMatrix, local.x, local.y);
}

function computeStrokeScale(viewportMatrix: Matrix, transform: Matrix): number {
  const combined = multiplyMatrices(viewportMatrix, transform);
  const det = combined.a * combined.d - combined.b * combined.c;
  if (Number.isFinite(det) && det !== 0) {
    const scale = Math.sqrt(Math.abs(det));
    if (scale > 0) {
      return scale;
    }
  }
  const col1 = Math.hypot(combined.a, combined.b);
  const col2 = Math.hypot(combined.c, combined.d);
  const average = (col1 + col2) / 2;
  return average > 0 ? average : 1;
}

function parseTransform(raw: string | undefined): Matrix | null {
  if (!raw) {
    return null;
  }
  const regex = /([a-zA-Z]+)\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  let current = identityMatrix();
  let found = false;
  while ((match = regex.exec(raw)) !== null) {
    const type = match[1].toLowerCase();
    const params = parseNumberList(match[2]);
    const matrix = transformFromValues(type, params);
    if (matrix) {
      current = multiplyMatrices(current, matrix);
      found = true;
    }
  }
  return found ? current : null;
}

function transformFromValues(type: string, values: number[]): Matrix | null {
  switch (type) {
    case "matrix":
      if (values.length >= 6) {
        return {
          a: values[0],
          b: values[1],
          c: values[2],
          d: values[3],
          e: values[4],
          f: values[5],
        };
      }
      return null;
    case "translate": {
      const tx = Number.isFinite(values[0]) ? values[0] : 0;
      const ty = Number.isFinite(values[1]) ? values[1] : 0;
      return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
    }
    case "scale": {
      const sx = Number.isFinite(values[0]) ? values[0] : 1;
      const sy = Number.isFinite(values[1]) ? values[1] : sx;
      return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
    }
    case "rotate": {
      const angle = (Number.isFinite(values[0]) ? values[0] : 0) * (Math.PI / 180);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      let base: Matrix = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
      if (values.length >= 3 && Number.isFinite(values[1]) && Number.isFinite(values[2])) {
        const cx = values[1];
        const cy = values[2];
        const translateTo: Matrix = { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy };
        const translateBack: Matrix = { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy };
        base = multiplyMatrices(translateTo, multiplyMatrices(base, translateBack));
      }
      return base;
    }
    case "skewx": {
      const angle = (Number.isFinite(values[0]) ? values[0] : 0) * (Math.PI / 180);
      return { a: 1, b: 0, c: Math.tan(angle), d: 1, e: 0, f: 0 };
    }
    case "skewy": {
      const angle = (Number.isFinite(values[0]) ? values[0] : 0) * (Math.PI / 180);
      return { a: 1, b: Math.tan(angle), c: 0, d: 1, e: 0, f: 0 };
    }
    default:
      return null;
  }
}

function parseNumberList(value: string): number[] {
  const result: number[] = [];
  const regex = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    const parsed = Number.parseFloat(match[0]);
    if (Number.isFinite(parsed)) {
      result.push(parsed);
    }
  }
  return result;
}

function parsePreserveAspectRatio(raw: string | undefined): PreserveAspectRatioConfig {
  const defaultValue: PreserveAspectRatioConfig = { align: "xMidYMid", meetOrSlice: "meet" };
  if (!raw) {
    return defaultValue;
  }
  const tokens = raw.trim().split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) {
    return defaultValue;
  }

  const validAlignments: Record<string, AspectAlign> = {
    none: "none",
    xminymin: "xMinYMin",
    xmidymin: "xMidYMin",
    xmaxymin: "xMaxYMin",
    xminymid: "xMinYMid",
    xmidymid: "xMidYMid",
    xmaxymid: "xMaxYMid",
    xminymax: "xMinYMax",
    xmidymax: "xMidYMax",
    xmaxymax: "xMaxYMax",
  };

  let index = 0;
  let alignToken = tokens[index]?.toLowerCase() ?? "";
  if (alignToken === "defer") {
    index += 1;
    alignToken = tokens[index]?.toLowerCase() ?? "";
  }
  index += 1;

  let align = validAlignments[alignToken] ?? defaultValue.align;
  if (align === "none") {
    return { align: "none", meetOrSlice: "meet" };
  }

  let meetOrSlice: "meet" | "slice" = "meet";
  for (; index < tokens.length; index += 1) {
    const token = tokens[index]?.toLowerCase();
    if (token === "meet") {
      meetOrSlice = "meet";
      break;
    }
    if (token === "slice") {
      meetOrSlice = "slice";
      break;
    }
  }

  if (!validAlignments[alignToken]) {
    align = defaultValue.align;
  }

  return { align, meetOrSlice };
}

function getAlignFactors(align: AspectAlign): { x: number; y: number } {
  if (align === "none") {
    return { x: 0, y: 0 };
  }
  const horizontal = align.includes("xMid") ? 0.5 : align.includes("xMax") ? 1 : 0;
  const vertical = align.includes("YMid") ? 0.5 : align.includes("YMax") ? 1 : 0;
  return { x: horizontal, y: vertical };
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

  if (attrs["fill-rule"] !== undefined) {
    const rule = normalizeFillRule(attrs["fill-rule"]);
    if (rule) {
      style.fillRule = rule;
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
    fillRule: "nonzero",
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

function normalizeFillRule(value: string): "nonzero" | "evenodd" | undefined {
  const lower = value.trim().toLowerCase();
  if (lower === "nonzero" || lower === "evenodd") {
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
