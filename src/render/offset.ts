// src/render/offset.ts

import { type Rect, type RenderBox } from "../pdf/types.js";
import { log } from "../debug/log.js";

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
