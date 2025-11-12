/**
 * MaxRects glyph atlas packer (separate module).
 *
 * Implements MaxRects (Best Short Side Fit) packing with basic free-rect
 * splitting and pruning. This lives alongside the existing shelf packer so
 * we can switch to it safely and run tests incrementally.
 *
 * API mirrors glyph-atlas.ts: GlyphAtlasMaxRects with pack/getPages/getPlacement.
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

const DEFAULT_PAGE_SIZE = 2048;
const DEFAULT_PADDING = 3;

class Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  constructor(x: number, y: number, w: number, h: number) {
    this.x = x; this.y = y; this.width = w; this.height = h;
  }
}

function fnv1a32(buf: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < buf.length; i++) {
    h ^= buf[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export class GlyphAtlasMaxRects {
  private pageSize: number;
  private padding: number;
  private pages: {
    width: number;
    height: number;
    data: Uint8Array;
    freeRects: Rect[];
    usedArea: number;
    lastUsed: number;
  }[] = [];
  private placements = new Map<Key, AtlasPlacement>();
  private hashIndex = new Map<number, AtlasPlacement[]>();

  // Eviction / memory control (LRU)
  private maxPages = 8;
  setMaxPages(n: number) {
    if (!Number.isFinite(n) || n < 1) return;
    this.maxPages = Math.max(1, Math.floor(n));
    this.evictIfNeeded();
  }

  constructor(pageSize = DEFAULT_PAGE_SIZE, padding = DEFAULT_PADDING) {
    this.pageSize = Math.max(128, Math.floor(pageSize));
    this.padding = Math.max(0, Math.floor(padding));
  }

  setPageSize(px: number) {
    if (!Number.isFinite(px) || px <= 0) return;
    this.pageSize = Math.max(128, Math.floor(px));
  }

  setPadding(p: number) {
    this.padding = Math.max(0, Math.floor(p));
  }

  clear() {
    this.pages = [];
    this.placements.clear();
    this.hashIndex.clear();
  }

  getPages(): AtlasPage[] {
    return this.pages.map(p => ({ width: p.width, height: p.height, data: p.data.slice() }));
  }

  has(key: Key) { return this.placements.has(key); }
  getPlacement(key: Key): AtlasPlacement | null { return this.placements.get(key) ?? null; }
  stats() { return { pages: this.pages.length, placements: this.placements.size }; }

  pack(key: Key, mask: Uint8ClampedArray, w: number, h: number): AtlasPlacement | null {
    if (this.placements.has(key)) return this.placements.get(key)!;
    if (!mask || mask.length !== w * h) return null;

    const rw = w + this.padding * 2;
    const rh = h + this.padding * 2;
    if (rw <= 0 || rh <= 0) return null;

    // dedupe
    const hash = fnv1a32(new Uint8Array(mask.buffer, mask.byteOffset, mask.byteLength));
    const candList = this.hashIndex.get(hash);
    if (candList) {
      for (const cand of candList) {
        const page = this.pages[cand.pageIndex];
        if (!page) continue;
        let equal = true;
        for (let row = 0; row < h && equal; row++) {
          const srcOff = row * w;
          const dstRow = (cand.y + row) * page.width;
          for (let col = 0; col < w; col++) {
            const di = (dstRow + (cand.x + col)) * 4 + 3;
            if (mask[srcOff + col] !== page.data[di]) { equal = false; break; }
          }
        }
        if (equal) { this.placements.set(key, cand); return cand; }
      }
    }

    // try existing pages
    for (let pi = 0; pi < this.pages.length; pi++) {
      const page = this.pages[pi];
      const node = this.findPosition(page.freeRects, rw, rh);
      if (node) {
        const dstX = node.x + this.padding;
        const dstY = node.y + this.padding;
        this.blitToPage(page.data, page.width, page.height, dstX, dstY, mask, w, h);
        page.usedArea += rw * rh;
        page.lastUsed = Date.now();
        this.splitFreeRectangles(node, page.freeRects);
        this.pruneFreeList(page.freeRects);
        const placement: AtlasPlacement = { pageIndex: pi, x: dstX, y: dstY, width: w, height: h };
        this.placements.set(key, placement);
        const list = this.hashIndex.get(hash) ?? [];
        list.push(placement);
        this.hashIndex.set(hash, list);
        return placement;
      }
    }

    // create new page
    const pageW = this.pageSize, pageH = this.pageSize;
    if (rw > pageW || rh > pageH) return null;
    const data = new Uint8Array(pageW * pageH * 4);
    const freeRects: Rect[] = [new Rect(0, 0, pageW, pageH)];
    const page = { width: pageW, height: pageH, data, freeRects, usedArea: 0, lastUsed: Date.now() };
    this.pages.push(page);
    // enforce max pages after adding
    this.evictIfNeeded();

    const node = this.findPosition(page.freeRects, rw, rh);
    if (!node) return null;
    const dstX = node.x + this.padding;
    const dstY = node.y + this.padding;
    this.blitToPage(page.data, page.width, page.height, dstX, dstY, mask, w, h);
    page.usedArea += rw * rh;
    page.lastUsed = Date.now();
    this.splitFreeRectangles(node, page.freeRects);
    this.pruneFreeList(page.freeRects);
    const placement: AtlasPlacement = { pageIndex: this.pages.length - 1, x: dstX, y: dstY, width: w, height: h };
    this.placements.set(key, placement);
    const list = this.hashIndex.get(hash) ?? [];
    list.push(placement);
    this.hashIndex.set(hash, list);
    this.evictIfNeeded();
    return placement;
  }

  // Best Short Side Fit
  private findPosition(freeRects: Rect[], width: number, height: number): Rect | null {
    let bestRect: Rect | null = null;
    let bestShort = Infinity;
    let bestLong = Infinity;
    for (const r of freeRects) {
      if (r.width >= width && r.height >= height) {
        const leftoverW = r.width - width;
        const leftoverH = r.height - height;
        const shortSide = Math.min(leftoverW, leftoverH);
        const longSide = Math.max(leftoverW, leftoverH);
        if (shortSide < bestShort || (shortSide === bestShort && longSide < bestLong)) {
          bestShort = shortSide; bestLong = longSide;
          bestRect = new Rect(r.x, r.y, width, height);
        }
      }
      // rotated
      if (r.width >= height && r.height >= width) {
        const leftoverW = r.width - height;
        const leftoverH = r.height - width;
        const shortSide = Math.min(leftoverW, leftoverH);
        const longSide = Math.max(leftoverW, leftoverH);
        if (shortSide < bestShort || (shortSide === bestShort && longSide < bestLong)) {
          bestShort = shortSide; bestLong = longSide;
          bestRect = new Rect(r.x, r.y, height, width);
        }
      }
    }
    return bestRect;
  }

  private splitFreeRectangles(placed: Rect, freeRects: Rect[]) {
    const toAdd: Rect[] = [];
    for (let i = freeRects.length - 1; i >= 0; i--) {
      const r = freeRects[i];
      if (!this.intersect(r, placed)) continue;
      freeRects.splice(i, 1);
      if (placed.x > r.x && placed.x < r.x + r.width) toAdd.push(new Rect(r.x, r.y, placed.x - r.x, r.height));
      if (placed.x + placed.width < r.x + r.width) toAdd.push(new Rect(placed.x + placed.width, r.y, (r.x + r.width) - (placed.x + placed.width), r.height));
      if (placed.y > r.y && placed.y < r.y + r.height) toAdd.push(new Rect(r.x, r.y, r.width, placed.y - r.y));
      if (placed.y + placed.height < r.y + r.height) toAdd.push(new Rect(r.x, placed.y + placed.height, r.width, (r.y + r.height) - (placed.y + placed.height)));
    }
    for (const nr of toAdd) if (nr.width > 0 && nr.height > 0) freeRects.push(nr);
  }

  private pruneFreeList(freeRects: Rect[]) {
    for (let i = 0; i < freeRects.length; i++) {
      for (let j = i + 1; j < freeRects.length; j++) {
        const a = freeRects[i], b = freeRects[j];
        if (this.isContained(a, b)) { freeRects.splice(i, 1); i--; break; }
        if (this.isContained(b, a)) { freeRects.splice(j, 1); j--; }
      }
    }
  }

  private intersect(a: Rect, b: Rect) {
    return !(b.x >= a.x + a.width || b.x + b.width <= a.x || b.y >= a.y + a.height || b.y + b.height <= a.y);
  }
  private isContained(a: Rect, b: Rect) {
    return a.x >= b.x && a.y >= b.y && (a.x + a.width) <= (b.x + b.width) && (a.y + a.height) <= (b.y + b.height);
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
    // Rebuild hashIndex: remove entries referencing removed page and adjust indices
    const newHash = new Map<number, AtlasPlacement[]>();
    for (const [h, list] of this.hashIndex.entries()) {
      const newList: AtlasPlacement[] = [];
      for (const p of list) {
        if (p.pageIndex === idx) continue;
        if (p.pageIndex > idx) {
          newList.push({ ...p, pageIndex: p.pageIndex - 1 });
        } else {
          newList.push(p);
        }
      }
      if (newList.length > 0) newHash.set(h, newList);
    }
    this.hashIndex = newHash;
  }

  private blitToPage(pageData: Uint8Array, pageW: number, _pageH: number, dstX: number, dstY: number, mask: Uint8ClampedArray, w: number, h: number) {
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

export const globalGlyphAtlasMaxRects = new GlyphAtlasMaxRects(DEFAULT_PAGE_SIZE, DEFAULT_PADDING);
