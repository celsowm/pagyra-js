/**
 * Simple shelf-based glyph atlas packer.
 *
 * Purpose:
 * - Pack many small glyph alpha masks into one or more RGBA atlas pages.
 * - Provide placement metadata so caller can later extract or reference the region.
 *
 * Notes:
 * - This implementation focuses on correctness and simplicity (shelf packer).
 * - Atlas pages are stored as RGBA Uint8Array buffers where R=G=B=0 and A=mask.
 * - Does NOT yet integrate automatically with PDF image registration;
 *   that will be done in the rendering path in a follow-up step.
 */

export interface AtlasPlacement {
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AtlasPage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array; // RGBA
}

type Key = string;

const DEFAULT_PAGE_SIZE = 2048; // square atlas page default
// Increase base padding to reduce risk of blur bleeding between packed glyphs.
// We still add extraPadding from the caller (e.g. glyph-cache) for blur radius.
const PADDING = 2; // padding around glyphs to avoid bleeding

class Shelf {
  y: number;
  height: number;
  xCursor: number;
  remaining: number;
  constructor(y: number, height: number, pageWidth: number) {
    this.y = y;
    this.height = height;
    this.xCursor = 0;
    this.remaining = pageWidth;
  }
}

/**
 * AtlasManager
 */
export class GlyphAtlas {
  private pageSize = DEFAULT_PAGE_SIZE;
  private pages: { width: number; height: number; data: Uint8Array; shelves: Shelf[]; used: number; lastUsed: number }[] = [];
  private placements = new Map<Key, AtlasPlacement>();
  // LRU eviction control for shelf atlas
  private maxPages = 8;
  setMaxPages(n: number) {
    if (!Number.isFinite(n) || n < 1) return;
    this.maxPages = Math.max(1, Math.floor(n));
    this.evictIfNeeded();
  }

  constructor(pageSize = DEFAULT_PAGE_SIZE) {
    this.pageSize = pageSize;
  }

  clear() {
    this.pages = [];
    this.placements.clear();
  }

  getPages(): AtlasPage[] {
    return this.pages.map((p) => ({ width: p.width, height: p.height, data: p.data.slice() }));
  }

  has(key: Key): boolean {
    return this.placements.has(key);
  }

  getPlacement(key: Key): AtlasPlacement | null {
    return this.placements.get(key) ?? null;
  }

  /**
   * Pack an alpha mask into the atlas.
   * - key: unique identifier for the glyph (e.g., fontUid|gid|size|ss)
   * - mask: Uint8ClampedArray length = w*h
   * - w,h: dimensions
   * Returns placement or null on failure.
   */
  pack(key: Key, mask: Uint8ClampedArray, w: number, h: number, extraPadding = 0): AtlasPlacement | null {
    if (this.placements.has(key)) {
      return this.placements.get(key)!;
    }
    const pw = this.pageSize;
    const ph = this.pageSize;
    const pad = PADDING + Math.max(0, Math.floor(extraPadding));
    const rw = w + pad * 2;
    const rh = h + pad * 2;

    // Try existing pages
    for (let pi = 0; pi < this.pages.length; pi++) {
      const page = this.pages[pi];
      // try to fit in existing shelves
      for (const shelf of page.shelves) {
        if (rh <= shelf.height && rw <= shelf.remaining) {
          // place it
          const x = shelf.xCursor + pad;
          const y = shelf.y + pad;
          this.blitToPage(page.data, page.width, page.height, x, y, mask, w, h);
          shelf.xCursor += rw;
          shelf.remaining -= rw;
          page.used += rw * rh;
          page.lastUsed = Date.now();
          const placement: AtlasPlacement = { pageIndex: pi, x, y, width: w, height: h };
          this.placements.set(key, placement);
          return placement;
        }
      }

      // If no shelf fits, try to create a new shelf at bottom if space allows
      const usedHeight = page.shelves.reduce((s, sh) => s + sh.height, 0);
      if (usedHeight + rh <= page.height) {
        const shelfY = usedHeight;
        const shelf = new Shelf(shelfY, rh, page.width);
        page.shelves.push(shelf);
        // place at start
        const x = shelf.xCursor + pad;
        const y = shelf.y + pad;
        this.blitToPage(page.data, page.width, page.height, x, y, mask, w, h);
        shelf.xCursor += rw;
        shelf.remaining -= rw;
        page.used += rw * rh;
        page.lastUsed = Date.now();
        const placement: AtlasPlacement = { pageIndex: pi, x, y, width: w, height: h };
        this.placements.set(key, placement);
        return placement;
      }
    }

    // No existing page fits: create a new page
    const pageW = pw;
    const pageH = ph;
    const pageData = new Uint8Array(pageW * pageH * 4); // RGBA
    // default rgba zeros
    const newPage = { width: pageW, height: pageH, data: pageData, shelves: [] as Shelf[], used: 0, lastUsed: Date.now() };
    // create first shelf
    if (rh > pageH || rw > pageW) {
      // too large for page
      return null;
    }
    const shelf = new Shelf(0, rh, pageW);
    newPage.shelves.push(shelf);
    this.pages.push(newPage);
    // enforce max pages after adding page
    this.evictIfNeeded();
    const x = shelf.xCursor + pad;
    const y = shelf.y + pad;
    this.blitToPage(newPage.data, newPage.width, newPage.height, x, y, mask, w, h);
    shelf.xCursor += rw;
    shelf.remaining -= rw;
    newPage.used += rw * rh;
    newPage.lastUsed = Date.now();
    const placement: AtlasPlacement = { pageIndex: this.pages.length - 1, x, y, width: w, height: h };
    this.placements.set(key, placement);
    return placement;
  }

  private evictIfNeeded() {
    while (this.pages.length > this.maxPages) {
      this.evictLeastRecentlyUsedPage();
    }
  }

  private evictLeastRecentlyUsedPage() {
    if (this.pages.length === 0) return;
    let oldest = 0;
    let oldestTime = Infinity;
    for (let i = 0; i < this.pages.length; i++) {
      const p = this.pages[i];
      if (p.lastUsed < oldestTime) {
        oldestTime = p.lastUsed;
        oldest = i;
      }
    }
    this.evictPage(oldest);
  }

  private evictPage(idx: number) {
    if (idx < 0 || idx >= this.pages.length) return;
    // Remove page data
    this.pages.splice(idx, 1);
    // Remove placements that pointed to this page and adjust pageIndex for later pages
    for (const [k, placement] of Array.from(this.placements.entries())) {
      if (placement.pageIndex === idx) {
        this.placements.delete(k);
      } else if (placement.pageIndex > idx) {
        this.placements.set(k, { ...placement, pageIndex: placement.pageIndex - 1 });
      }
    }
    // NOTE: shelf atlas does not maintain a hashIndex for dedupe.
    // Eviction only updates placements above; nothing more to adjust here.
  }

  private blitToPage(pageData: Uint8Array, pageW: number, pageH: number, dstX: number, dstY: number, mask: Uint8ClampedArray, w: number, h: number) {
    // pageData is RGBA; we write R=G=B=0, A = mask
    for (let row = 0; row < h; row++) {
      const srcOff = row * w;
      const dstRow = (dstY + row) * pageW;
      let dstCol = dstX;
      for (let col = 0; col < w; col++) {
        const a = mask[srcOff + col];
        const di = (dstRow + dstCol) * 4;
        pageData[di] = 0;
        pageData[di + 1] = 0;
        pageData[di + 2] = 0;
        pageData[di + 3] = a;
        dstCol++;
      }
    }
  }
}

/** Singleton atlas for now (can be replaced with per-font/per-size atlases later) */
export const globalGlyphAtlas = new GlyphAtlas(DEFAULT_PAGE_SIZE);
