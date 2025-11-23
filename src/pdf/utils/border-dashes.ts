import type { BorderStyles, BorderStyle, Edges, Rect, RGBA, Radius, StrokeDash } from "../types.js";
import type { ShapePoint } from "../renderers/shape-renderer.js";

export type BorderSide = "top" | "right" | "bottom" | "left";

export interface BorderSideStroke {
  side: BorderSide;
  points: ShapePoint[];
  color: RGBA;
  lineWidth: number;
  dash?: StrokeDash;
}

export function computeDashForStyle(style: BorderStyle, widthPx: number): StrokeDash | undefined {
  const w = Math.max(widthPx, 0);
  if (!Number.isFinite(w) || w <= 0) {
    return undefined;
  }

  const normalized = style.toLowerCase() as BorderStyle;

  if (normalized === "dashed") {
    const base = w;
    return { pattern: [3 * base, 3 * base], phase: 0 };
  }

  if (normalized === "dotted") {
    const base = w;
    return { pattern: [base, base], phase: 0 };
  }

  return undefined;
}

export function computeBorderSideStrokes(
  borderBox: Rect,
  borderWidth: Edges,
  borderStyle: BorderStyles,
  color: RGBA,
  _radius: Radius,
): BorderSideStroke[] {
  const result: BorderSideStroke[] = [];

  const outerX = borderBox.x;
  const outerY = borderBox.y;
  const outerW = borderBox.width;
  const outerH = borderBox.height;

  if (!Number.isFinite(outerW) || !Number.isFinite(outerH) || outerW <= 0 || outerH <= 0) {
    return result;
  }

  const topCenterY = outerY + borderWidth.top / 2;
  const bottomCenterY = outerY + outerH - borderWidth.bottom / 2;
  const leftCenterX = outerX + borderWidth.left / 2;
  const rightCenterX = outerX + outerW - borderWidth.right / 2;

  const pushSide = (side: BorderSide, width: number, style: BorderStyle, p1: ShapePoint, p2: ShapePoint): void => {
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    const normalized = style.toLowerCase() as BorderStyle;
    if (normalized === "none") {
      return;
    }

    result.push({
      side,
      points: [p1, p2],
      color,
      lineWidth: width,
      dash: computeDashForStyle(normalized, width),
    });
  };

  pushSide(
    "top",
    borderWidth.top,
    borderStyle.top,
    { x: leftCenterX, y: topCenterY },
    { x: rightCenterX, y: topCenterY },
  );

  pushSide(
    "right",
    borderWidth.right,
    borderStyle.right,
    { x: rightCenterX, y: topCenterY },
    { x: rightCenterX, y: bottomCenterY },
  );

  pushSide(
    "bottom",
    borderWidth.bottom,
    borderStyle.bottom,
    { x: rightCenterX, y: bottomCenterY },
    { x: leftCenterX, y: bottomCenterY },
  );

  pushSide(
    "left",
    borderWidth.left,
    borderStyle.left,
    { x: leftCenterX, y: bottomCenterY },
    { x: leftCenterX, y: topCenterY },
  );

  return result;
}
