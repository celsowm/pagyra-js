import type { NormalizedPathCommand } from "../../svg/path-data.js";

const CIRCLE_KAPPA = 0.5522847498307936;

export function buildRectSegments(x: number, y: number, width: number, height: number): NormalizedPathCommand[] {
  return [
    { type: "M", x, y },
    { type: "L", x: x + width, y },
    { type: "L", x: x + width, y: y + height },
    { type: "L", x, y: y + height },
    { type: "Z" },
  ];
}

export function buildRoundedRectSegments(x: number, y: number, width: number, height: number, rx: number, ry: number): NormalizedPathCommand[] {
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

export function buildEllipseSegments(cx: number, cy: number, rx: number, ry: number): NormalizedPathCommand[] {
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
