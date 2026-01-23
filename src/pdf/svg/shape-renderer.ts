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
import type { StrokeOptions } from "../types.js";
import { parsePathData } from "../../svg/path-data.js";
import { buildEllipseSegments, buildRectSegments, buildRoundedRectSegments } from "./geometry-builder.js";
import { mapPathSegments, mapPoints, mapSvgPoint } from "./coordinate-mapper.js";
import { resolvePaint } from "./style-computer.js";
import { clampAlpha } from "../utils/color-utils.js";
import { applyMatrixToPoint, multiplyMatrices } from "../../geometry/matrix.js";
import { parseTransform } from "../../transform/css-parser.js";
import type { SvgLinearGradientNode } from "../../svg/types.js";
import type { SvgRadialGradientNode } from "../../svg/types.js";
import { parseLinearGradient, type LinearGradient } from "../../css/parsers/gradient-parser.js";
import type { RadialGradient } from "../../css/parsers/gradient-parser.js";

function isLinearGradientPaint(value: unknown): value is LinearGradient {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<LinearGradient>;
  return candidate.type === "linear" && Array.isArray((candidate as any).stops);
}

function isRadialGradientPaint(value: unknown): value is RadialGradient {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RadialGradient>;
  return candidate.type === "radial" && typeof (candidate as any).r === "number";
}

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
  // If fill is a gradient (including url(...) referencing a <linearGradient> or <radialGradient> in defs), handle via painter gradient APIs
  const gradient = resolveGradientPaint(style.fill, context);
  if (gradient) {
    // Map rectangle corners to viewport/page coordinates
    const p1 = mapSvgPoint(x, y, context);
    const p2 = mapSvgPoint(x + width, y + height, context);
    if (p1 && p2) {
      const pxRect = { x: p1.x, y: p1.y, width: p2.x - p1.x, height: p2.y - p1.y };
      if ((gradient as RadialGradient).type === "radial") {
        if (rx > 0 || ry > 0) {
          context.painter.fillRoundedRect(pxRect, {
            topLeft: { x: rx, y: ry },
            topRight: { x: rx, y: ry },
            bottomRight: { x: rx, y: ry },
            bottomLeft: { x: rx, y: ry },
          }, gradient as RadialGradient);
        } else {
          context.painter.fillRect(pxRect, gradient as RadialGradient);
        }
      } else {
        if (rx > 0 || ry > 0) {
          context.painter.fillRoundedRect(pxRect, {
            topLeft: { x: rx, y: ry },
            topRight: { x: rx, y: ry },
            bottomRight: { x: rx, y: ry },
            bottomLeft: { x: rx, y: ry },
          }, gradient as LinearGradient);
        } else {
          context.painter.fillRect(pxRect, gradient as LinearGradient);
        }
      }
      return;
    }
  }

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
  // Try resolving gradient paint first. For circle fills we special-case gradients and
  // draw them by creating a rounded-rect (square) clipping path sized to the circle's
  // bounding box. This reuses the ShapeRenderer's rounded-rect clipping + shading logic
  // and produces a visually correct circular fill via the cubic-curve approximation.
  const gradient = resolveGradientPaint(style.fill, context);
  if (gradient) {
    // Map center and an edge point to page pixels
    const center = mapSvgPoint(cx, cy, context);
    const edge = mapSvgPoint(cx + radius, cy, context);
    if (center && edge) {
      const rPx = Math.sqrt((edge.x - center.x) ** 2 + (edge.y - center.y) ** 2);
      const pxRect = { x: center.x - rPx, y: center.y - rPx, width: rPx * 2, height: rPx * 2 };
      const radii = {
        topLeft: { x: rPx, y: rPx },
        topRight: { x: rPx, y: rPx },
        bottomRight: { x: rPx, y: rPx },
        bottomLeft: { x: rPx, y: rPx },
      };
      if ((gradient as RadialGradient).type === "radial") {
        context.painter.fillRoundedRect(pxRect, radii, gradient as RadialGradient);
      } else {
        context.painter.fillRoundedRect(pxRect, radii, gradient as LinearGradient);
      }
      return;
    }
    // If mapping failed, fall back to path-based fill below
  }

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
    context.painter.strokePolyline(mapped, strokeColor, {
      ...getStrokeOptions(style, context),
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
    context.painter.strokePolyline(mapped, strokeColor, {
      ...getStrokeOptions(style, context),
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
  context.painter.strokePolyline(points, strokeColor, {
    ...getStrokeOptions(style, context),
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
  // Try to resolve a gradient paint server first (supports url(#id) references and CSS gradients)
  const gradient = resolveGradientPaint(style.fill, context);
  if (gradient) {
    // Use the new painter API to paint arbitrary path commands with a gradient. The ShapeRenderer will
    // create a clipping path from the provided commands and paint the shading clipped to the path.
    context.painter.fillPathWithGradient(commands, gradient, { fillRule });
    return;
  }
  const fillColor = resolvePaint(style.fill, style.opacity * style.fillOpacity);
  if (fillColor) {
    context.painter.fillPath(commands, fillColor, { fillRule: fillRule ?? style.fillRule });
  }
  const strokeColor = resolvePaint(style.stroke, style.opacity * style.strokeOpacity);
  if (strokeColor) {
    context.painter.strokePath(commands, strokeColor, getStrokeOptions(style, context));
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

function resolveGradientPaint(paint: unknown, context?: SvgRenderContext): LinearGradient | RadialGradient | null {
  // If already gradient object, return it
  if (isLinearGradientPaint(paint) || isRadialGradientPaint(paint)) return paint as LinearGradient | RadialGradient;
  if (typeof paint === "string") {
    const trimmed = paint.trim();
    const urlMatch = trimmed.match(/^url\(\s*#([^)\s]+)\s*\)$/i);
    if (urlMatch && context) {
      const defs = (context as any).defs as Map<string, any> | undefined;
      if (defs) {
        const node = defs.get(urlMatch[1]);
        if (node && (node.type === "lineargradient" || node.type === "radialgradient")) {
          if (node.type === "lineargradient") {
            return svgLinearNodeToLinearGradient(node as unknown as SvgLinearGradientNode, context);
          }
          return svgRadialNodeToRadialGradient(node as unknown as SvgRadialGradientNode, context);
        }
      }
    }
    // fallback to CSS linear-gradient(...) strings
    return parseLinearGradient(paint);
  }
  return null;
}

function svgLinearNodeToLinearGradient(node: SvgLinearGradientNode, context?: SvgRenderContext): LinearGradient {
  const x1 = node.x1 ?? 0;
  const y1 = node.y1 ?? 0;
  const x2 = node.x2 ?? 1;
  const y2 = node.y2 ?? 0;

  const stops = (node.stops ?? []).map((s) => ({ color: s.color, position: s.offset }));

  // Default: objectBoundingBox coordinates (ratio 0..1)
  const units = node.gradientUnits === "userSpaceOnUse" ? "userSpace" : "ratio";

  // If userSpaceOnUse, map points to page pixels using the SVG render context
  if (units === "userSpace" && context) {
    const p1 = mapSvgPoint(x1, y1, context);
    const p2 = mapSvgPoint(x2, y2, context);
    if (p1 && p2) {
      // coords in absolute page pixels; gradient-service will convert to rectangle-local points
      return { type: "linear", direction: "to right", stops, coords: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, units: "userSpace" } };
    }
    // fallback to ratio if mapping failed
  }

  // objectBoundingBox: keep ratio coords (0..1)
  // Apply gradientTransform if present — treat it as operating in gradient coordinate space
  let rp1 = { x: x1, y: y1 };
  let rp2 = { x: x2, y: y2 };
  const rawTransform = (node.attributes && (node.attributes["gradientTransform"] ?? node.attributes["gradienttransform"])) as string | undefined;
  if (rawTransform) {
    const t = parseTransform(rawTransform) || undefined;
    if (t) {
      rp1 = applyMatrixToPoint(t, rp1.x, rp1.y);
      rp2 = applyMatrixToPoint(t, rp2.x, rp2.y);
    }
  }

  // compute direction angle from ratio coords (useful when no explicit coords provided)
  const dx = rp2.x - rp1.x;
  const dy = rp2.y - rp1.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const direction = `${angle.toFixed(2)}deg`;

  return { type: "linear", direction, stops, coords: { x1: rp1.x, y1: rp1.y, x2: rp2.x, y2: rp2.y, units: "ratio" } };
}

function svgRadialNodeToRadialGradient(node: SvgRadialGradientNode, context?: SvgRenderContext): RadialGradient {
  const cx = node.cx ?? 0.5;
  const cy = node.cy ?? 0.5;
  const r = node.r ?? 0.5;
  const fx = node.fx;
  const fy = node.fy;
  const stops = (node.stops ?? []).map((s) => ({ color: s.color, position: s.offset }));

  const units = node.gradientUnits === "userSpaceOnUse" ? "userSpace" : "ratio";

  if (units === "userSpace" && context) {
    const center = mapSvgPoint(cx, cy, context);
    const focal = fx !== undefined && fy !== undefined ? mapSvgPoint(fx, fy, context) : undefined;
    const radiusPt = (() => {
      // map a point at cx + r, cy to user space and compute distance
      const edge = mapSvgPoint(cx + r, cy, context);
      if (center && edge) {
        const dx = edge.x - center.x;
        const dy = edge.y - center.y;
        return Math.sqrt(dx * dx + dy * dy);
      }
      return undefined;
    })();

    // If mapping succeeded, return a userSpace radial gradient with absolute coords
    if (center && radiusPt !== undefined) {
      const rad: RadialGradient = {
        type: "radial",
        cx: center.x,
        cy: center.y,
        r: radiusPt,
        stops,
        coordsUnits: "userSpace",
      };
      if (focal) {
        rad.fx = focal.x;
        rad.fy = focal.y;
      }
      return rad;
    }
    // fallback to ratio below
  }
  // objectBoundingBox (ratio) coordinates;
  // Keep raw coords in ratio units and, if a gradientTransform is present, preserve it
  // on the returned RadialGradient so the shading creation can emit a PDF /Matrix that
  // maps ratio-space circles to device-space ellipses exactly.
  const radRatio: RadialGradient = {
    type: "radial",
    cx: cx,
    cy: cy,
    r: r,
    stops,
  };
  if (fx !== undefined && fy !== undefined) {
    radRatio.fx = fx;
    radRatio.fy = fy;
  }

  const rawTransform = (node.attributes && (node.attributes["gradientTransform"] ?? node.attributes["gradienttransform"])) as string | undefined;
  if (rawTransform) {
    const t = parseTransform(rawTransform) || undefined;
    if (t) {
      // Preserve the parsed transform matrix on the RadialGradient for use by the
      // gradient service when building the PDF shading dictionary.
      radRatio.transform = { a: t.a, b: t.b, c: t.c, d: t.d, e: t.e, f: t.f };
    }
  }

  return radRatio;
}

function getStrokeOptions(style: SvgStyle, context: SvgRenderContext): StrokeOptions {
  const strokeWidthPx = (style.strokeWidth ?? 1) * context.strokeScale;
  const options: StrokeOptions = {
    lineWidth: strokeWidthPx > 0 ? strokeWidthPx : undefined,
    lineCap: style.strokeLinecap,
    lineJoin: style.strokeLinejoin,
  };

  if (style.strokeDashArray && style.strokeDashArray.length > 0) {
    const pattern = style.strokeDashArray.map((v) => v * context.strokeScale);
    const phase = (style.strokeDashOffset ?? 0) * context.strokeScale;
    options.dash = { pattern, phase };
  }

  return options;
}
