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

  if (safeWidth <= 0) {
    result.topLeft.x = 0;
    result.topRight.x = 0;
    result.bottomRight.x = 0;
    result.bottomLeft.x = 0;
  } else {
    const topSum = result.topLeft.x + result.topRight.x;
    if (topSum > safeWidth && topSum > 0) {
      const scale = safeWidth / topSum;
      result.topLeft.x *= scale;
      result.topRight.x *= scale;
    }
    const bottomSum = result.bottomLeft.x + result.bottomRight.x;
    if (bottomSum > safeWidth && bottomSum > 0) {
      const scale = safeWidth / bottomSum;
      result.bottomLeft.x *= scale;
      result.bottomRight.x *= scale;
    }
  }

  if (safeHeight <= 0) {
    result.topLeft.y = 0;
    result.topRight.y = 0;
    result.bottomRight.y = 0;
    result.bottomLeft.y = 0;
  } else {
    const leftSum = result.topLeft.y + result.bottomLeft.y;
    if (leftSum > safeHeight && leftSum > 0) {
      const scale = safeHeight / leftSum;
      result.topLeft.y *= scale;
      result.bottomLeft.y *= scale;
    }
    const rightSum = result.topRight.y + result.bottomRight.y;
    if (rightSum > safeHeight && rightSum > 0) {
      const scale = safeHeight / rightSum;
      result.topRight.y *= scale;
      result.bottomRight.y *= scale;
    }
  }

  return result;
}
