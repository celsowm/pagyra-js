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
 * 
 * For 'space' mode: tiles are repeated with even spacing between them
 * For 'round' mode: tiles are scaled to fit perfectly without gaps
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

  // Handle 'space' mode
  if (repeat === "space") {
    return computeSpacedTiles(tileRect, clipRect);
  }

  // Handle 'round' mode
  if (repeat === "round") {
    return computeRoundedTiles(tileRect, clipRect);
  }

  // Handle standard repeat modes (repeat, repeat-x, repeat-y)
  const repeatX = repeat === "repeat" || repeat === "repeat-x";
  const repeatY = repeat === "repeat" || repeat === "repeat-y";

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
    if (ty + height <= clipRect.y && !repeatY) {
      break;
    }

    for (let ix = startIx; ; ix++) {
      const tx = tileRect.x + ix * width;
      if (tx >= maxX) {
        break;
      }
      if (tx + width <= clipRect.x && !repeatX) {
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

/**
 * Computes tiles for 'space' mode: tiles are repeated with even spacing.
 * The first and last tiles touch the edges of the clip rect.
 */
function computeSpacedTiles(tileRect: Rect, clipRect: Rect): Rect[] {
  const result: Rect[] = [];
  const tileWidth = tileRect.width;
  const tileHeight = tileRect.height;
  const availableWidth = clipRect.width;
  const availableHeight = clipRect.height;

  // Calculate how many tiles fit in each direction
  const tilesX = Math.max(1, Math.floor(availableWidth / tileWidth));
  const tilesY = Math.max(1, Math.floor(availableHeight / tileHeight));

  // Calculate spacing between tiles
  const spacingX = tilesX > 1 ? (availableWidth - tilesX * tileWidth) / (tilesX - 1) : 0;
  const spacingY = tilesY > 1 ? (availableHeight - tilesY * tileHeight) / (tilesY - 1) : 0;

  // Generate tiles with spacing
  for (let iy = 0; iy < tilesY; iy++) {
    const ty = clipRect.y + iy * (tileHeight + spacingY);

    for (let ix = 0; ix < tilesX; ix++) {
      const tx = clipRect.x + ix * (tileWidth + spacingX);

      const candidate: Rect = {
        x: tx,
        y: ty,
        width: tileWidth,
        height: tileHeight
      };

      const clipped = intersectRects(candidate, clipRect);
      if (clipped) {
        result.push(clipped);
      }
    }
  }

  return result;
}

/**
 * Computes tiles for 'round' mode: tiles are scaled to fit perfectly.
 * Tiles are stretched or shrunk so they fit without gaps or clipping.
 */
function computeRoundedTiles(tileRect: Rect, clipRect: Rect): Rect[] {
  const result: Rect[] = [];
  const tileWidth = tileRect.width;
  const tileHeight = tileRect.height;
  const availableWidth = clipRect.width;
  const availableHeight = clipRect.height;

  // Calculate how many tiles would fit (rounded to nearest integer)
  const tilesX = Math.max(1, Math.round(availableWidth / tileWidth));
  const tilesY = Math.max(1, Math.round(availableHeight / tileHeight));

  // Calculate scaled tile dimensions
  const scaledWidth = availableWidth / tilesX;
  const scaledHeight = availableHeight / tilesY;

  // Generate scaled tiles
  for (let iy = 0; iy < tilesY; iy++) {
    const ty = clipRect.y + iy * scaledHeight;

    for (let ix = 0; ix < tilesX; ix++) {
      const tx = clipRect.x + ix * scaledWidth;

      const candidate: Rect = {
        x: tx,
        y: ty,
        width: scaledWidth,
        height: scaledHeight
      };

      const clipped = intersectRects(candidate, clipRect);
      if (clipped) {
        result.push(clipped);
      }
    }
  }

  return result;
}
