// src/render/offset.ts

import { type Rect, type RenderBox, type Background } from "../pdf/types.js";
import { log } from "../logging/debug.js";
import type { PageMarginsPx } from "../units/page-utils.js";

export function offsetRect(rect: Rect | null | undefined, dx: number, dy: number): void {
  if (!rect) return;
  rect.x += dx;
  rect.y += dy;
}

function offsetClipPath(box: RenderBox, dx: number, dy: number): void {
  if (!box.clipPath) return;
  if (box.clipPath.type === "polygon") {
    for (const point of box.clipPath.points) {
      point.x += dx;
      point.y += dy;
    }
  } else if (box.clipPath.type === "ellipse") {
    box.clipPath.cx += dx;
    box.clipPath.cy += dy;
  }
}

function offsetBackground(background: Background | undefined, dx: number, dy: number): void {
  if (!background) {
    return;
  }
  if (background.image) {
    offsetRect(background.image.rect, dx, dy);
    offsetRect(background.image.originRect, dx, dy);
  }
  if (background.gradient) {
    offsetRect(background.gradient.rect, dx, dy);
    offsetRect(background.gradient.originRect, dx, dy);
  }
}

export function offsetRenderTree(root: RenderBox, dx: number, dy: number, _debug: boolean): void {
  const stack: RenderBox[] = [root];
  while (stack.length > 0) {
    const box = stack.pop()!;
    log("layout","trace",'offset render tree box', {
      tagName: box.tagName,
      textContent: box.textContent,
      x: box.contentBox.x,
      y: box.contentBox.y,
      width: box.contentBox.width,
      height: box.contentBox.height,
    });
    offsetRect(box.contentBox, dx, dy);
    offsetRect(box.paddingBox, dx, dy);
    offsetRect(box.borderBox, dx, dy);
    offsetRect(box.visualOverflow, dx, dy);
    offsetClipPath(box, dx, dy);
    if (box.markerRect) {
      offsetRect(box.markerRect, dx, dy);
    }
    if (box.maskGradient) {
      offsetRect(box.maskGradient.rect, dx, dy);
      offsetRect(box.maskGradient.originRect, dx, dy);
    }
    offsetBackground(box.background, dx, dy);
    for (const link of box.links) {
      offsetRect(link.rect, dx, dy);
    }
    for (const run of box.textRuns) {
      if (run.lineMatrix) {
        run.lineMatrix.e += dx;
        run.lineMatrix.f += dy;
      }
    }
    for (const child of box.children) {
      stack.push(child);
    }
  }
}

export interface PageVerticalMarginsOptions {
  /** Page height in pixels */
  pageHeight: number;
  /** Page margins */
  margins: PageMarginsPx;
  /** Header height in pixels (content will be pushed down by this amount) */
  headerHeightPx?: number;
  /** Footer height in pixels (reduces available content area) */
  footerHeightPx?: number;
}

/**
 * Handles 'break-inside: avoid' by pushing content to the next page
 * when a box would otherwise cross a page boundary.
 */
export function applyBreakInsideAvoid(root: RenderBox, usablePageHeight: number): void {
  let globalOffset = 0;

  function traverse(box: RenderBox) {
    // Apply cumulative offset from previous breaks
    if (globalOffset > 0) {
      offsetBox(box, 0, globalOffset);
    }

    const rect = box.borderBox ?? box.contentBox;
    const top = rect.y;
    const bottom = rect.y + rect.height;

    const startPage = Math.floor(top / usablePageHeight);
    const endPage = Math.floor((bottom - 0.001) / usablePageHeight);

    if (box.breakInside === "avoid" && startPage !== endPage) {
      const nextPageTop = (startPage + 1) * usablePageHeight;
      const pushDown = nextPageTop - top;
      if (pushDown > 0) {
        log("layout", "debug", `break-inside: avoid triggered for ${box.tagName} id:${box.id}. Pushing down by ${pushDown}px`, {
          tagName: box.tagName,
          id: box.id,
          top,
          bottom,
          nextPageTop,
        });
        offsetBox(box, 0, pushDown);
        globalOffset += pushDown;
      }
    }

    // Recurse into children. They will be shifted by current globalOffset.
    for (const child of box.children) {
      traverse(child);
    }
  }

  function offsetBox(box: RenderBox, dx: number, dy: number) {
    offsetRect(box.contentBox, dx, dy);
    offsetRect(box.paddingBox, dx, dy);
    offsetRect(box.borderBox, dx, dy);
    offsetRect(box.visualOverflow, dx, dy);
    offsetClipPath(box, dx, dy);
    if (box.markerRect) {
      offsetRect(box.markerRect, dx, dy);
    }
    if (box.maskGradient) {
      offsetRect(box.maskGradient.rect, dx, dy);
      offsetRect(box.maskGradient.originRect, dx, dy);
    }
    offsetBackground(box.background, dx, dy);
    for (const link of box.links) {
      offsetRect(link.rect, dx, dy);
    }
    for (const run of box.textRuns) {
      if (run.lineMatrix) {
        run.lineMatrix.e += dx;
        run.lineMatrix.f += dy;
      }
    }
  }

  traverse(root);
}

export function applyPageVerticalMargins(root: RenderBox, pageHeight: number, margins: PageMarginsPx): void {
  applyPageVerticalMarginsWithHf(root, { pageHeight, margins });
}

/**
 * Applies vertical margins and header/footer offsets to the render tree.
 * This implements Word/mPDF-like behavior where:
 * - Content starts below the top margin + header height
 * - Content ends above the bottom margin + footer height
 * - Each page has the header/footer space reserved
 */
export function applyPageVerticalMarginsWithHf(
  root: RenderBox,
  options: PageVerticalMarginsOptions,
): void {
  const { pageHeight, margins, headerHeightPx = 0, footerHeightPx = 0 } = options;

  const safePageHeight = Number.isFinite(pageHeight) && pageHeight > 0 ? pageHeight : 1;
  const marginTop = Number.isFinite(margins.top) && margins.top > 0 ? margins.top : 0;
  const marginBottom = Number.isFinite(margins.bottom) && margins.bottom > 0 ? margins.bottom : 0;

  // Effective top offset includes margin AND header
  const effectiveTop = marginTop + headerHeightPx;
  // Effective bottom includes margin AND footer
  const effectiveBottom = marginBottom + footerHeightPx;
  const totalReserved = effectiveTop + effectiveBottom;

  // Usable height for content per page
  const usableHeight = safePageHeight - totalReserved > 0 ? safePageHeight - totalReserved : safePageHeight;

  const mapY = (value: number): number => {
    if (!Number.isFinite(value)) {
      return value;
    }
    if (value <= 0) {
      return value + effectiveTop;
    }
    const pageIndex = Math.floor(value / usableHeight);
    const remainder = value - pageIndex * usableHeight;
    return pageIndex * safePageHeight + effectiveTop + remainder;
  };

  const adjustRect = (rect: Rect | null | undefined): void => {
    if (!rect) {
      return;
    }
    rect.y = mapY(rect.y);
  };

  const adjustBackground = (background: Background | undefined): void => {
    if (!background) {
      return;
    }
    if (background.image) {
      adjustRect(background.image.rect);
      adjustRect(background.image.originRect);
    }
    if (background.gradient) {
      adjustRect(background.gradient.rect);
      adjustRect(background.gradient.originRect);
    }
  };

  const stack: RenderBox[] = [root];
  while (stack.length > 0) {
    const box = stack.pop()!;
    adjustRect(box.contentBox);
    adjustRect(box.paddingBox);
    adjustRect(box.borderBox);
    adjustRect(box.visualOverflow);
    if (box.clipPath) {
      if (box.clipPath.type === "polygon") {
        for (const point of box.clipPath.points) {
          point.y = mapY(point.y);
        }
      } else if (box.clipPath.type === "ellipse") {
        box.clipPath.cy = mapY(box.clipPath.cy);
      }
    }
    if (box.markerRect) {
      adjustRect(box.markerRect);
    }
    if (box.maskGradient) {
      adjustRect(box.maskGradient.rect);
      adjustRect(box.maskGradient.originRect);
    }
    adjustBackground(box.background);
    for (const link of box.links) {
      adjustRect(link.rect);
    }
    for (const run of box.textRuns) {
      if (run.lineMatrix) {
        run.lineMatrix.f = mapY(run.lineMatrix.f);
      }
    }
    for (const child of box.children) {
      stack.push(child);
    }
  }
}
