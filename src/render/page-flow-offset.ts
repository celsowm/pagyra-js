import type { Background, Rect, RenderBox } from "../pdf/types.js";
import { log } from "../logging/debug.js";
import type { PageFlowMetrics } from "../layout/fragmentation/page-flow.js";

const EPSILON = 0.001;

/** Moves break-inside: avoid boxes using the actual printable height of each page. */
export function applyBreakInsideAvoidWithPageFlow(
  root: RenderBox,
  pageFlow: PageFlowMetrics,
): void {
  let globalOffset = 0;

  const traverse = (box: RenderBox): void => {
    if (globalOffset > 0) {
      offsetBoxGeometry(box, 0, globalOffset);
    }

    const rect = box.borderBox ?? box.contentBox;
    const top = rect.y;
    const bottom = rect.y + rect.height;
    const startPage = pageFlow.pageIndexAtContentY(top);
    const endPage = pageFlow.pageIndexAtContentY(bottom - EPSILON);

    if (box.breakInside === "avoid" && startPage !== endPage) {
      const nextPageTop = pageFlow.contentStartForPage(startPage + 1);
      const pushDown = nextPageTop - top;
      if (pushDown > 0) {
        log("layout", "debug", `break-inside: avoid triggered for ${box.tagName} id:${box.id}`, {
          tagName: box.tagName,
          id: box.id,
          top,
          bottom,
          nextPageTop,
          pushDown,
        });
        offsetBoxGeometry(box, 0, pushDown);
        globalOffset += pushDown;
      }
    }

    for (const child of box.children) {
      traverse(child);
    }
  };

  traverse(root);
}

/**
 * Converts continuous content coordinates to physical page coordinates and
 * applies the left margin selected by @page :first/:left/:right.
 */
export function applyPageFlowOffsets(
  root: RenderBox,
  pageFlow: PageFlowMetrics,
  debug: boolean,
): void {
  const adjustRect = (rect: Rect | null | undefined): void => {
    if (!rect) {
      return;
    }
    const pageIndex = pageFlow.pageIndexAtContentY(rect.y);
    rect.x += pageFlow.marginsForPage(pageIndex).left;
    rect.y = pageFlow.physicalYForContentY(rect.y);
  };

  const adjustPoint = (point: { x: number; y: number }): void => {
    const pageIndex = pageFlow.pageIndexAtContentY(point.y);
    point.x += pageFlow.marginsForPage(pageIndex).left;
    point.y = pageFlow.physicalYForContentY(point.y);
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
    if (debug) {
      log("layout", "trace", "map render box to page flow", {
        id: box.id,
        tagName: box.tagName,
        x: box.contentBox.x,
        y: box.contentBox.y,
      });
    }

    adjustRect(box.contentBox);
    adjustRect(box.paddingBox);
    adjustRect(box.borderBox);
    adjustRect(box.visualOverflow);

    if (box.clipPath?.type === "polygon") {
      for (const point of box.clipPath.points) {
        adjustPoint(point);
      }
    } else if (box.clipPath?.type === "ellipse") {
      const pageIndex = pageFlow.pageIndexAtContentY(box.clipPath.cy);
      box.clipPath.cx += pageFlow.marginsForPage(pageIndex).left;
      box.clipPath.cy = pageFlow.physicalYForContentY(box.clipPath.cy);
    }

    adjustRect(box.markerRect);
    if (box.maskGradient) {
      adjustRect(box.maskGradient.rect);
      adjustRect(box.maskGradient.originRect);
    }
    adjustBackground(box.background);

    for (const link of box.links) {
      adjustRect(link.rect);
    }
    for (const run of box.textRuns) {
      if (!run.lineMatrix) {
        continue;
      }
      const pageIndex = pageFlow.pageIndexAtContentY(run.lineMatrix.f);
      run.lineMatrix.e += pageFlow.marginsForPage(pageIndex).left;
      run.lineMatrix.f = pageFlow.physicalYForContentY(run.lineMatrix.f);
    }
    for (const child of box.children) {
      stack.push(child);
    }
  }
}

function offsetBoxGeometry(box: RenderBox, dx: number, dy: number): void {
  offsetRect(box.contentBox, dx, dy);
  offsetRect(box.paddingBox, dx, dy);
  offsetRect(box.borderBox, dx, dy);
  offsetRect(box.visualOverflow, dx, dy);

  if (box.clipPath?.type === "polygon") {
    for (const point of box.clipPath.points) {
      point.x += dx;
      point.y += dy;
    }
  } else if (box.clipPath?.type === "ellipse") {
    box.clipPath.cx += dx;
    box.clipPath.cy += dy;
  }

  offsetRect(box.markerRect, dx, dy);
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

function offsetRect(rect: Rect | null | undefined, dx: number, dy: number): void {
  if (!rect) {
    return;
  }
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
