import type { PagePainter } from "../page-painter.js";
import type { RenderBox, Rect, Radius } from "../types.js";
import { shrinkRadius } from "./radius.js";

function determineBackgroundPaintArea(box: RenderBox): { rect: Rect; radius: Radius } | null {
  const rect = box.borderBox ?? box.paddingBox ?? box.contentBox;
  if (!rect) {
    return null;
  }

  if (rect === box.borderBox) {
    return { rect, radius: box.borderRadius };
  }

  let radius = shrinkRadius(box.borderRadius, box.border.top, box.border.right, box.border.bottom, box.border.left);
  if (rect === box.contentBox) {
    radius = shrinkRadius(radius, box.padding.top, box.padding.right, box.padding.bottom, box.padding.left);
  }

  return { rect, radius };
}

export function paintSingleBackground(painter: PagePainter, box: RenderBox): void {
  const background = box.background;
  if (!background) {
    return;
  }

  const paintArea = determineBackgroundPaintArea(box);
  if (!paintArea) {
    return;
  }

  if (background.color) {
    painter.fillRoundedRect(paintArea.rect, paintArea.radius, background.color);
  }

  if (background.gradient) {
    painter.fillRoundedRect(paintArea.rect, paintArea.radius, background.gradient as any);
  }

  if (background.image) {
    const layer = background.image;
    if (layer.repeat && layer.repeat !== "no-repeat") {
      console.warn(`Background repeat mode "${layer.repeat}" is not fully supported yet. Rendering first tile only.`);
    }
    painter.drawBackgroundImage(layer.image, layer.rect, paintArea.rect, paintArea.radius);
  }
}

function hasVisibleBorder(border: RenderBox["border"]): boolean {
  return border.top > 0 || border.right > 0 || border.bottom > 0 || border.left > 0;
}

export function paintSingleBorder(painter: PagePainter, box: RenderBox): void {
  const color = box.borderColor;
  if (!color) {
    return;
  }
  const { border } = box;
  if (!hasVisibleBorder(border)) {
    return;
  }
  const outerRect = box.borderBox;
  const innerRect = {
    x: outerRect.x + border.left,
    y: outerRect.y + border.top,
    width: Math.max(outerRect.width - border.left - border.right, 0),
    height: Math.max(outerRect.height - border.top - border.bottom, 0),
  };
  const innerRadius = shrinkRadius(box.borderRadius, border.top, border.right, border.bottom, border.left);
  if (innerRect.width <= 0 || innerRect.height <= 0) {
    painter.fillRoundedRect(outerRect, box.borderRadius, color);
  } else {
    painter.fillRoundedRectDifference(outerRect, box.borderRadius, innerRect, innerRadius, color);
  }
}
