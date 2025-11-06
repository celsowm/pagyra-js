import { pickFooterVariant, pickHeaderVariant, paintHeaderFooter, type HeaderFooterLayout } from "../header-footer.js";
import { PagePainter, type PainterResult } from "../page-painter.js";
import type { FontRegistry } from "../font/font-registry.js";
import { LayerMode, NodeKind } from "../types.js";
import type { LayoutPageTree, PageSize, Radius, RenderBox, RGBA, Rect, TextPaintOptions } from "../types.js";
import { paintBoxShadows } from "./paint-box-shadows.js";
import { clampRadiusComponent, shrinkRadius } from "./radius.js";
import { renderSvgBox } from "../svg/render-svg.js";

export interface PagePaintInput {
  readonly pageTree: LayoutPageTree;
  readonly pageNumber: number;
  readonly totalPages: number;
  readonly pageSize: PageSize;
  readonly pxToPt: (px: number) => number;
  readonly pageWidthPx: number;
  readonly pageHeightPx: number;
  readonly fontRegistry: FontRegistry;
  readonly headerFooterLayout: HeaderFooterLayout;
  readonly tokens: Map<string, string | ((page: number, total: number) => string)>;
  readonly headerFooterTextOptions: TextPaintOptions;
  readonly pageBackground?: RGBA;
}

export async function paintLayoutPage({
  pageTree,
  pageNumber,
  totalPages,
  pageSize,
  pxToPt,
  pageWidthPx,
  pageHeightPx,
  fontRegistry,
  headerFooterLayout,
  tokens,
  headerFooterTextOptions,
  pageBackground,
}: PagePaintInput): Promise<PainterResult> {
  const painter = new PagePainter(pageSize.heightPt, pxToPt, fontRegistry, pageTree.pageOffsetY);

  const headerVariant = pickHeaderVariant(headerFooterLayout, pageNumber, totalPages);
  const footerVariant = pickFooterVariant(headerFooterLayout, pageNumber, totalPages);

  paintPageBackground(painter, pageBackground, pageWidthPx, pageHeightPx, pageTree.pageOffsetY);

  if (headerFooterLayout.layerMode === LayerMode.Under) {
    await paintHeaderFooter(painter, headerVariant, footerVariant, tokens, pageNumber, totalPages, headerFooterTextOptions, true);
  }

  paintBoxShadows(painter, pageTree.paintOrder, false);
  paintBackgrounds(painter, pageTree.paintOrder);
  paintBoxShadows(painter, pageTree.paintOrder, true);
  paintBorders(painter, pageTree.paintOrder);
  await paintSvg(painter, pageTree.flowContentOrder);
  paintImages(painter, pageTree.flowContentOrder);
  await paintText(painter, pageTree.flowContentOrder);

  if (headerFooterLayout.layerMode === LayerMode.Over) {
    await paintHeaderFooter(painter, headerVariant, footerVariant, tokens, pageNumber, totalPages, headerFooterTextOptions, false);
  }

  return painter.result();
}

async function paintText(painter: PagePainter, boxes: RenderBox[]): Promise<void> {
  for (const box of boxes) {
    for (const run of box.textRuns) {
      await painter.drawTextRun(run);
    }
  }
}

function paintBackgrounds(painter: PagePainter, boxes: RenderBox[]): void {
  for (const box of boxes) {
    const background = box.background;
    if (!background) {
      continue;
    }

    const paintArea = determineBackgroundPaintArea(box);
    if (!paintArea) {
      continue;
    }

    if (background.color) {
      painter.fillRoundedRect(paintArea.rect, paintArea.radius, background.color);
    }

    if (background.gradient) {
      painter.fillRoundedRect(paintArea.rect, paintArea.radius, background.gradient as any);
    }

    if (background.image) {
      paintBackgroundImageLayer(painter, background.image, paintArea.rect, paintArea.radius);
    }
  }
}

function paintBackgroundImageLayer(
  painter: PagePainter,
  layer: RenderBox["background"]["image"],
  clipRect: Rect,
  clipRadius: Radius,
): void {
  if (!layer) {
    return;
  }
  if (layer.repeat && layer.repeat !== "no-repeat") {
    console.warn(`Background repeat mode "${layer.repeat}" is not fully supported yet. Rendering first tile only.`);
  }
  painter.drawBackgroundImage(layer.image, layer.rect, clipRect, clipRadius);
}

function paintBorders(painter: PagePainter, boxes: RenderBox[]): void {
  for (const box of boxes) {
    const color = box.borderColor;
    if (!color) {
      continue;
    }
    const { border } = box;
    if (!hasVisibleBorder(border)) {
      continue;
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
}

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

function hasVisibleBorder(border: RenderBox["border"]): boolean {
  return border.top > 0 || border.right > 0 || border.bottom > 0 || border.left > 0;
}

function paintImages(painter: PagePainter, boxes: RenderBox[]): void {
  for (const box of boxes) {
    if (box.image) {
      painter.drawImage(box.image, box.contentBox);
    }
  }
}

async function paintSvg(painter: PagePainter, boxes: RenderBox[]): Promise<void> {
  for (const box of boxes) {
    if (box.kind === NodeKind.Svg || (box.tagName === "svg" && box.customData?.svg)) {
      await renderSvgBox(painter, box);
    }
    if (box.children.length > 0) {
      await paintSvg(painter, box.children);
    }
  }
}

function paintPageBackground(painter: PagePainter, color: RGBA | undefined, widthPx: number, heightPx: number, offsetY: number): void {
  if (!color) {
    return;
  }
  if (!Number.isFinite(widthPx) || widthPx <= 0 || !Number.isFinite(heightPx) || heightPx <= 0) {
    return;
  }
  const rect: Rect = { x: 0, y: offsetY, width: widthPx, height: heightPx };
  painter.fillRect(rect, color);
}
