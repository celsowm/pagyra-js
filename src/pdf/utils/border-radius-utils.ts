import type { ComputedStyle } from "../../css/style.js";
import type { Rect, Radius } from "../types.js";

export function resolveBorderRadius(style: ComputedStyle, borderBox: Rect): Radius {
  const raw: Radius = {
    topLeft: {
      x: clampRadius(style.borderTopLeftRadiusX),
      y: clampRadius(style.borderTopLeftRadiusY),
    },
    topRight: {
      x: clampRadius(style.borderTopRightRadiusX),
      y: clampRadius(style.borderTopRightRadiusY),
    },
    bottomRight: {
      x: clampRadius(style.borderBottomRightRadiusX),
      y: clampRadius(style.borderBottomRightRadiusY),
    },
    bottomLeft: {
      x: clampRadius(style.borderBottomLeftRadiusX),
      y: clampRadius(style.borderBottomLeftRadiusY),
    },
  };
  return normalizeBorderRadius(raw, borderBox.width, borderBox.height);
}

function clampRadius(value: number | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 0;
  }
  const numeric = Number(value);
  return numeric > 0 ? numeric : 0;
}

export function normalizeBorderRadius(input: Radius, width: number, height: number): Radius {
  const result: Radius = {
    topLeft: { ...input.topLeft },
    topRight: { ...input.topRight },
    bottomRight: { ...input.bottomRight },
    bottomLeft: { ...input.bottomLeft },
  };

  const safeWidth = Math.max(width, 0);
  const safeHeight = Math.max(height, 0);

  if (safeWidth <= 0 || safeHeight <= 0) {
    return {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 0, y: 0 },
      bottomRight: { x: 0, y: 0 },
      bottomLeft: { x: 0, y: 0 },
    };
  }

  // CSS Backgrounds § 5.5: compute a single scale factor f = min(Li/Si)
  // across all four sides, then multiply ALL radii by f if f < 1.
  let f = 1;
  const topSumX = result.topLeft.x + result.topRight.x;
  if (topSumX > 0) f = Math.min(f, safeWidth / topSumX);
  const bottomSumX = result.bottomLeft.x + result.bottomRight.x;
  if (bottomSumX > 0) f = Math.min(f, safeWidth / bottomSumX);
  const leftSumY = result.topLeft.y + result.bottomLeft.y;
  if (leftSumY > 0) f = Math.min(f, safeHeight / leftSumY);
  const rightSumY = result.topRight.y + result.bottomRight.y;
  if (rightSumY > 0) f = Math.min(f, safeHeight / rightSumY);

  if (f < 1) {
    result.topLeft.x *= f;
    result.topLeft.y *= f;
    result.topRight.x *= f;
    result.topRight.y *= f;
    result.bottomRight.x *= f;
    result.bottomRight.y *= f;
    result.bottomLeft.x *= f;
    result.bottomLeft.y *= f;
  }

  return result;
}
