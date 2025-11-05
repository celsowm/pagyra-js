import { log } from "../../debug/log.js";
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

  // Paint the entire render tree recursively. The paintRecursive function
  // handles the correct stacking context painting order.
  await paintRecursive(painter, pageTree.root);

  if (headerFooterLayout.layerMode === LayerMode.Over) {
    await paintHeaderFooter(painter, headerVariant, footerVariant, tokens, pageNumber, totalPages, headerFooterTextOptions, false);
  }

  return painter.result();
}

async function paintBoxContent(painter: PagePainter, box: RenderBox): Promise<void> {
  await paintSvg(painter, [box]);
  paintImages(painter, [box]);
  await paintText(painter, [box]);
}

function paintBoxDecorations(painter: PagePainter, box: RenderBox): void {
  paintBoxShadows(painter, [box], false);
  paintBackgrounds(painter, [box]);
  paintBoxShadows(painter, [box], true);
  paintBorders(painter, [box]);
}


async function paintRecursive(painter: PagePainter, box: RenderBox): Promise<void> {
  // This function implements the W3C painting algorithm for stacking contexts.
  // Every box is treated as a potential stacking context root for its descendants.

  // 1. Paint the background and borders of the element itself.
  paintBoxDecorations(painter, box);

  // Separate children into positioned and in-flow groups.
  const positionedChildren = box.children.filter(c => c.positioning.type !== 'normal');
  const inFlowChildren = box.children.filter(c => c.positioning.type === 'normal');

  // Stably sort positioned elements by their computed z-index.
  const indexedPositioned = positionedChildren.map((child, index) => ({ child, index }));
  indexedPositioned.sort((a, b) => {
    const zA = a.child.zIndexComputed ?? 0;
    const zB = b.child.zIndexComputed ?? 0;
    if (zA !== zB) {
      return zA - zB;
    }
    return a.index - b.index; // Fallback to DOM order for stability
  });
  const sortedPositionedChildren = indexedPositioned.map(item => item.child);

  // 2. Paint positioned descendants with negative z-indexes.
  for (const child of sortedPositionedChildren) {
    if (child.zIndexComputed < 0) {
      await paintRecursive(painter, child);
    }
  }

  // 3. Paint in-flow, non-positioned descendants.
  for (const child of inFlowChildren) {
    await paintRecursive(painter, child);
  }

  // 4. Paint the element's own content (text, images, etc.).
  await paintBoxContent(painter, box);

  // 5. Paint positioned descendants with z-index: 0 / auto.
  for (const child of sortedPositionedChildren) {
    if (child.zIndexComputed === 0) {
      await paintRecursive(painter, child);
    }
  }

  // 6. Paint positioned descendants with positive z-indexes.
  for (const child of sortedPositionedChildren) {
    if (child.zIndexComputed > 0) {
      await paintRecursive(painter, child);
    }
  }
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
    log("PAINT_TRACE", "TRACE", `op=fill id=${box.htmlId ?? box.id} z=${box.zIndexComputed}`, { background });

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
    log("PAINT_TRACE", "TRACE", `op=stroke id=${box.htmlId ?? box.id} z=${box.zIndexComputed}`, { border: box.border, color });
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
