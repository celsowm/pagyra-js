// src/render/offset.ts

import { type Rect, type RenderBox } from "../pdf/types.js";
import { log } from "../debug/log.js";
import type { PageMarginsPx } from "../units/page-utils.js";

export function offsetRect(rect: Rect | null | undefined, dx: number, dy: number): void {
  if (!rect) return;
  rect.x += dx;
  rect.y += dy;
}

export function offsetRenderTree(root: RenderBox, dx: number, dy: number, debug: boolean): void {
  const stack: RenderBox[] = [root];
  while (stack.length > 0) {
    const box = stack.pop()!;
    log("RENDER_TREE","TRACE",'offset render tree box', {
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
    if (box.markerRect) {
      offsetRect(box.markerRect, dx, dy);
    }
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

export function applyPageVerticalMargins(root: RenderBox, pageHeight: number, margins: PageMarginsPx): void {
  const safePageHeight = Number.isFinite(pageHeight) && pageHeight > 0 ? pageHeight : 1;
  const marginTop = Number.isFinite(margins.top) && margins.top > 0 ? margins.top : 0;
  const marginBottom = Number.isFinite(margins.bottom) && margins.bottom > 0 ? margins.bottom : 0;
  const totalMargin = marginTop + marginBottom;
  const usableHeight = safePageHeight - totalMargin > 0 ? safePageHeight - totalMargin : safePageHeight;

  const mapY = (value: number): number => {
    if (!Number.isFinite(value)) {
      return value;
    }
    if (value <= 0) {
      return value + marginTop;
    }
    const pageIndex = Math.floor(value / usableHeight);
    const remainder = value - pageIndex * usableHeight;
    return pageIndex * safePageHeight + marginTop + remainder;
  };

  const adjustRect = (rect: Rect | null | undefined): void => {
    if (!rect) {
      return;
    }
    rect.y = mapY(rect.y);
  };

  const stack: RenderBox[] = [root];
  while (stack.length > 0) {
    const box = stack.pop()!;
    adjustRect(box.contentBox);
    adjustRect(box.paddingBox);
    adjustRect(box.borderBox);
    adjustRect(box.visualOverflow);
    if (box.markerRect) {
      adjustRect(box.markerRect);
    }
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
