import type { SvgPoint } from "../../svg/types.js";
import type { NormalizedPathCommand } from "../../svg/path-data.js";
import type { PathCommand } from "../renderers/shape-renderer.js";
import type { SvgRenderContext } from "./render-svg.js";
import { applyMatrixToPoint } from "../../geometry/matrix.js";

export function mapPoints(points: readonly SvgPoint[], context: SvgRenderContext): { x: number; y: number }[] {
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

export function mapPathSegments(segments: readonly NormalizedPathCommand[], context: SvgRenderContext): PathCommand[] | null {
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

export function mapSvgPoint(x: number, y: number, context: SvgRenderContext): { x: number; y: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const mapped = mapPointToViewport(context, x, y);
  if (!Number.isFinite(mapped.x) || !Number.isFinite(mapped.y)) {
    return null;
  }
  return mapped;
}

function mapPointToViewport(context: SvgRenderContext, x: number, y: number): { x: number; y: number } {
  const local = applyMatrixToPoint(context.transform, x, y);
  return applyMatrixToPoint(context.viewportMatrix, local.x, local.y);
}
