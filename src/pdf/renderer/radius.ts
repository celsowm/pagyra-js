import type { Radius } from "../types.js";

export function cloneRadius(radius: Radius): Radius {
  return {
    topLeft: { x: radius.topLeft.x, y: radius.topLeft.y },
    topRight: { x: radius.topRight.x, y: radius.topRight.y },
    bottomRight: { x: radius.bottomRight.x, y: radius.bottomRight.y },
    bottomLeft: { x: radius.bottomLeft.x, y: radius.bottomLeft.y },
  };
}

export function shrinkRadius(radii: Radius, top: number, right: number, bottom: number, left: number): Radius {
  return {
    topLeft: {
      x: clampRadiusComponent(radii.topLeft.x - top),
      y: clampRadiusComponent(radii.topLeft.y - left),
    },
    topRight: {
      x: clampRadiusComponent(radii.topRight.x - top),
      y: clampRadiusComponent(radii.topRight.y - right),
    },
    bottomRight: {
      x: clampRadiusComponent(radii.bottomRight.x - bottom),
      y: clampRadiusComponent(radii.bottomRight.y - right),
    },
    bottomLeft: {
      x: clampRadiusComponent(radii.bottomLeft.x - bottom),
      y: clampRadiusComponent(radii.bottomLeft.y - left),
    },
  };
}

export function adjustRadius(radius: Radius, delta: number): Radius {
  const result = cloneRadius(radius);
  result.topLeft.x = clampNonNegative(result.topLeft.x + delta);
  result.topLeft.y = clampNonNegative(result.topLeft.y + delta);
  result.topRight.x = clampNonNegative(result.topRight.x + delta);
  result.topRight.y = clampNonNegative(result.topRight.y + delta);
  result.bottomRight.x = clampNonNegative(result.bottomRight.x + delta);
  result.bottomRight.y = clampNonNegative(result.bottomRight.y + delta);
  result.bottomLeft.x = clampNonNegative(result.bottomLeft.x + delta);
  result.bottomLeft.y = clampNonNegative(result.bottomLeft.y + delta);
  return result;
}

export function clampRadiusComponent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value > 0 ? value : 0;
}

export function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value;
}
