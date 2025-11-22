import type { BitmapMask } from "./rasterizer.js";
import { flattenOutline, rasterizeContours } from "./rasterizer.js";
import type { TtfFontMetrics } from "../../types/fonts.js";
import type { GlyphOutlineCmd } from "../../types/fonts.js";
import { globalGlyphAtlas } from "./glyph-atlas.js";
import type { AtlasPlacement } from "./glyph-atlas.js";
import { blurAlpha } from "./blur.js";

/**
 * Glyph mask cache with simple LRU eviction.
 *
 * - Keyed by (unitsPerEm + headBBox) | gid | fontSizePx | supersample
 * - Stores BitmapMask values (alpha-only or RGBA depending on usage)
 * - Default maxEntries set to 500 (configurable)
 *
 * This keeps the previous helper behavior but adds a bounded cache to limit memory.
 */

type CacheKey = string;

let maxEntries = 500;
const glyphMaskCache = new Map<CacheKey, BitmapMask>();
// store atlas placements per cached key to allow later atlas-based rendering
const glyphAtlasPlacements = new Map<CacheKey, AtlasPlacement | null>();

export function setGlyphMaskCacheMaxEntries(n: number) {
  if (!Number.isFinite(n) || n <= 0) return;
  maxEntries = Math.max(1, Math.floor(n));
  // Trim if needed
  trimCacheIfNeeded();
}

function trimCacheIfNeeded() {
  while (glyphMaskCache.size > maxEntries) {
    // Evict oldest entry (Map preserves insertion order)
    const oldestKey = glyphMaskCache.keys().next().value;
    if (!oldestKey) break;
    glyphMaskCache.delete(oldestKey);
  }
}

function makeKey(metrics: TtfFontMetrics, gid: number, fontSizePx: number, supersample = 4, blurPx = 0): CacheKey {
  const uid = `${metrics.metrics.unitsPerEm}-${(metrics.headBBox ? metrics.headBBox.join(",") : "nbb")}`;
  // Use one-decimal precision for blur in the key to avoid unnecessary cache churn for fractional radii
  const blurKey = Math.round(Math.max(0, blurPx || 0) * 10) / 10;
  return `${uid}|gid:${gid}|size:${Math.round(fontSizePx)}|ss:${supersample}|blur:${blurKey}`;
}

/**
 * Get or create an alpha mask for a glyph.
 * Returns null if outline is not available or rasterization failed.
 */
export function getGlyphMask(metrics: TtfFontMetrics, gid: number, fontSizePx: number, supersample = 4, blurPx = 0): BitmapMask | null {
  const key = makeKey(metrics, gid, fontSizePx, supersample, blurPx);
  const cached = glyphMaskCache.get(key);
  if (cached) {
    // LRU: move to most-recently-used (end)
    glyphMaskCache.delete(key);
    glyphMaskCache.set(key, cached);
    return cached;
  }

  if (!metrics.getGlyphOutline) return null;
  const cmds: GlyphOutlineCmd[] | null = metrics.getGlyphOutline(gid);
  if (!cmds || cmds.length === 0) return null;

  const unitsPerEm = metrics.metrics.unitsPerEm || 1000;
  const scale = fontSizePx / unitsPerEm;

  try {
    const { contours } = flattenOutline(cmds, scale, 0.5);
    const mask = rasterizeContours(contours, supersample);
    if (!mask) return null;

    // If blur requested, apply blur to alpha buffer first
    let alphaBuf = mask.data;
    if (blurPx && blurPx > 0) {
      alphaBuf = blurAlpha(mask.data, mask.width, mask.height, blurPx);
    }

    // Compute extra padding to reserve space in atlas for blur bleed (more conservative heuristic)
    // Use a larger multiplier and a small safety margin to avoid clipped blurred glyphs.
    const extraPadding = blurPx && blurPx > 0 ? Math.ceil(blurPx * 2) + 2 : 0;

    // Attempt to pack into global atlas (best-effort) using alphaBuf and extra padding
    try {
      const placement = globalGlyphAtlas.pack(key, alphaBuf, mask.width, mask.height, extraPadding);
      glyphAtlasPlacements.set(key, placement);
    } catch {
      glyphAtlasPlacements.set(key, null);
    }

    // Cache the final mask (with blurred alpha if applied)
    // Ensure the stored buffer matches the BitmapMask type (Uint8ClampedArray)
    const clamped = alphaBuf instanceof Uint8ClampedArray ? alphaBuf : new Uint8ClampedArray(alphaBuf);
    const finalMask: BitmapMask = {
      width: mask.width,
      height: mask.height,
      data: clamped,
      offsetX: mask.offsetX,
      offsetY: mask.offsetY,
    };
    glyphMaskCache.set(key, finalMask);
    trimCacheIfNeeded();
    return finalMask;
  } catch {
    // Defensive: don't throw; return null to let caller fallback
    return null;
  }
}

/** Utility to clear cache (useful for tests) */
export function clearGlyphMaskCache(): void {
  glyphMaskCache.clear();
  glyphAtlasPlacements.clear();
}

/** Return atlas placement for a cached glyph key (if available) */
export function getGlyphAtlasPlacement(metrics: TtfFontMetrics, gid: number, fontSizePx: number, supersample = 4, blurPx = 0): AtlasPlacement | null {
  const key = makeKey(metrics, gid, fontSizePx, supersample, blurPx);
  return glyphAtlasPlacements.get(key) ?? null;
}

/** For debugging / introspection */
export function glyphMaskCacheStats(): { entries: number; maxEntries: number } {
  return { entries: glyphMaskCache.size, maxEntries };
}
