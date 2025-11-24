// src/render/offset.ts

import { type Rect, type RenderBox, type Background } from "../pdf/types.js";
import { log } from "../logging/debug.js";
import type { PageMarginsPx } from "../units/page-utils.js";

export function offsetRect(rect: Rect | null | undefined, dx: number, dy: number): void {
  if (!rect) return;
  rect.x += dx;
  rect.y += dy;
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
    if (box.markerRect) {
      offsetRect(box.markerRect, dx, dy);
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
    if (box.markerRect) {
      adjustRect(box.markerRect);
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
