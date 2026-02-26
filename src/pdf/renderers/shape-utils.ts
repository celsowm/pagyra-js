import type { RGBA, Rect, ShapePoint } from "../types.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";
import { parseLinearGradient, parseRadialGradient } from "../../css/parsers/gradient-parser.js";

export function strokeColorCommand(color: RGBA): string {
  const r = formatNumber(normalizeChannel(color.r));
  const g = formatNumber(normalizeChannel(color.g));
  const b = formatNumber(normalizeChannel(color.b));
  return `${r} ${g} ${b} RG`;
}

export function fillColorCommand(color: RGBA): string {
  const r = formatNumber(normalizeChannel(color.r));
  const g = formatNumber(normalizeChannel(color.g));
  const b = formatNumber(normalizeChannel(color.b));
  // Alpha blending is handled through ExtGState assignments (see pushFillCommands).
  return `${r} ${g} ${b} rg`;
}

export function mapLineCap(cap: "butt" | "round" | "square" | undefined): number | undefined {
  switch (cap) {
    case "butt":
      return 0;
    case "round":
      return 1;
    case "square":
      return 2;
    default:
      return undefined;
  }
}

export function mapLineJoin(join: "miter" | "round" | "bevel" | undefined): number | undefined {
  switch (join) {
    case "miter":
      return 0;
    case "round":
      return 1;
    case "bevel":
      return 2;
    default:
      return undefined;
  }
}

export function normalizeChannel(value: number): number {
  if (value > 1) {
    return value / 255;
  }
  return value;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function rectToPdf(
  rect: Rect | null | undefined,
  coordinateTransformer: CoordinateTransformer,
  transformContext: Rect | null
): { x: string; y: string; width: string; height: string } | null {
  if (!rect) {
    return null;
  }
  const widthPx = Math.max(rect.width, 0);
  const heightPx = Math.max(rect.height, 0);
  if (widthPx === 0 || heightPx === 0) {
    return null;
  }

  // If in transform context, use relative coordinates
  if (transformContext) {
    const relX = rect.x - transformContext.x;
    const relY = rect.y - transformContext.y;
    const x = coordinateTransformer.convertPxToPt(relX);
    const y = coordinateTransformer.convertPxToPt(-(relY + heightPx)); // Negative for PDF y-axis
    const width = coordinateTransformer.convertPxToPt(widthPx);
    const height = coordinateTransformer.convertPxToPt(heightPx);
    return {
      x: formatNumber(x),
      y: formatNumber(y),
      width: formatNumber(width),
      height: formatNumber(height),
    };
  }

  // Normal absolute positioning
  const localY = rect.y - coordinateTransformer.pageOffsetPx;
  const x = coordinateTransformer.convertPxToPt(rect.x);
  const y = coordinateTransformer.pageHeightPt - coordinateTransformer.convertPxToPt(localY + heightPx);
  const width = coordinateTransformer.convertPxToPt(widthPx);
  const height = coordinateTransformer.convertPxToPt(heightPx);
  return {
    x: formatNumber(x),
    y: formatNumber(y),
    width: formatNumber(width),
    height: formatNumber(height),
  };
}

export function pointToPdf(
  point: ShapePoint,
  coordinateTransformer: CoordinateTransformer,
  transformContext: Rect | null
): { x: string; y: string } | null {
  // If in transform context, use relative coordinates
  if (transformContext) {
    const relX = point.x - transformContext.x;
    const relY = point.y - transformContext.y;
    const x = coordinateTransformer.convertPxToPt(relX);
    const y = coordinateTransformer.convertPxToPt(-relY); // Negative for PDF y-axis
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return {
      x: formatNumber(x),
      y: formatNumber(y),
    };
  }

  // Normal absolute positioning
  const localY = point.y - coordinateTransformer.pageOffsetPx;
  const x = coordinateTransformer.convertPxToPt(point.x);
  const y = coordinateTransformer.pageHeightPt - coordinateTransformer.convertPxToPt(localY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return {
    x: formatNumber(x),
    y: formatNumber(y),
  };
}

export function pointsToPdf(
  points: ShapePoint[],
  coordinateTransformer: CoordinateTransformer,
  transformContext: Rect | null
): Array<{ x: string; y: string }> | null {
  const result: Array<{ x: string; y: string }> = [];
  for (const point of points) {
    const converted = pointToPdf(point, coordinateTransformer, transformContext);
    if (!converted) {
      return null;
    }
    result.push(converted);
  }
  return result;
}

export function transformForRect(rect: Rect, coordinateTransformer: CoordinateTransformer, transformContext: Rect | null): string {
  // If we're in a transform context, use relative coordinates
  if (transformContext) {
    const relX = rect.x - transformContext.x;
    const relY = rect.y - transformContext.y;
    const scaleX = coordinateTransformer.convertPxToPt(1);
    const scaleY = coordinateTransformer.convertPxToPt(1);
    const translateX = coordinateTransformer.convertPxToPt(relX);
    const translateY = coordinateTransformer.convertPxToPt(-relY); // Negative because PDF y-axis is flipped
    return `${formatNumber(scaleX)} 0 0 ${formatNumber(-scaleY)} ${formatNumber(translateX)} ${formatNumber(translateY)} cm`;
  }

  // Normal absolute positioning
  const scaleX = coordinateTransformer.convertPxToPt(1);
  const scaleY = coordinateTransformer.convertPxToPt(1);
  const localY = rect.y - coordinateTransformer.pageOffsetPx;
  const translateX = coordinateTransformer.convertPxToPt(rect.x);
  const translateY = coordinateTransformer.pageHeightPt - coordinateTransformer.convertPxToPt(localY);
  return `${formatNumber(scaleX)} 0 0 ${formatNumber(-scaleY)} ${formatNumber(translateX)} ${formatNumber(translateY)} cm`;
}

export function resolveGradientPaint(paint: unknown): import("../../css/parsers/gradient-parser.js").LinearGradient | import("../../css/parsers/gradient-parser.js").RadialGradient | null {
  if (isLinearGradientPaint(paint) || isRadialGradientPaint(paint)) {
    return paint as import("../../css/parsers/gradient-parser.js").LinearGradient | import("../../css/parsers/gradient-parser.js").RadialGradient;
  }
  if (typeof paint === "string") {
    return parseLinearGradient(paint) ?? parseRadialGradient(paint);
  }
  return null;
}

function isLinearGradientPaint(value: unknown): value is import("../../css/parsers/gradient-parser.js").LinearGradient {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<import("../../css/parsers/gradient-parser.js").LinearGradient>;
  return candidate.type === "linear" && Array.isArray(candidate.stops);
}

function isRadialGradientPaint(value: unknown): value is import("../../css/parsers/gradient-parser.js").RadialGradient {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<import("../../css/parsers/gradient-parser.js").RadialGradient>;
  return candidate.type === "radial" && typeof candidate.r === "number";
}
