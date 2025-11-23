import type { BackgroundRepeat } from "../../css/background-types.js";
import type { Rect } from "../types.js";

export function intersectRects(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = right - x;
  const height = bottom - y;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

export function rectEquals(a: Rect | undefined, b: Rect | undefined, epsilon = 0.01): boolean {
  if (!a || !b) {
    return false;
  }
  return (
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.width - b.width) < epsilon &&
    Math.abs(a.height - b.height) < epsilon
  );
}

/**
 * Computes the tile rectangles for a background layer inside a clipping rect,
 * honoring the repeat mode. Returned rects are already intersected with the
 * clip rect (they never extend outside).
 */
export function computeBackgroundTileRects(tileRect: Rect, clipRect: Rect, repeat: BackgroundRepeat): Rect[] {
  const width = tileRect.width;
  const height = tileRect.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return [];
  }

  if (repeat === "no-repeat") {
    const single = intersectRects(tileRect, clipRect);
    return single ? [single] : [];
  }

  const repeatX = repeat === "repeat" || repeat === "repeat-x" || repeat === "space" || repeat === "round";
  const repeatY = repeat === "repeat" || repeat === "repeat-y" || repeat === "space" || repeat === "round";

  const result: Rect[] = [];

  const startIx = repeatX ? Math.floor((clipRect.x - tileRect.x) / width) : 0;
  const startIy = repeatY ? Math.floor((clipRect.y - tileRect.y) / height) : 0;

  const maxX = clipRect.x + clipRect.width;
  const maxY = clipRect.y + clipRect.height;

  for (let iy = startIy; ; iy++) {
    const ty = tileRect.y + iy * height;
    if (ty >= maxY) {
      break;
    }
    if (ty + height <= clipRect.x && !repeatY) {
      // Single row above viewport and non-repeating on Y – nothing to paint
      break;
    }

    for (let ix = startIx; ; ix++) {
      const tx = tileRect.x + ix * width;
      if (tx >= maxX) {
        break;
      }
      if (tx + width <= clipRect.x && !repeatX) {
        // Single column left of viewport and non-repeating on X – nothing to paint
        break;
      }

      const candidate: Rect = { x: tx, y: ty, width, height };
      const clipped = intersectRects(candidate, clipRect);
      if (clipped) {
        result.push(clipped);
      }

      if (!repeatX) {
        break;
      }
    }

    if (!repeatY) {
      break;
    }
  }

  return result;
}

