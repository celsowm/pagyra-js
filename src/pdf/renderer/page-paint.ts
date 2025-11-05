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
  await paintRecursive(painter, pageTree.root, 0);

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

function paintBoxDecorations(painter: PagePainter, box: RenderBox, contextZ: number): void {
  paintBoxShadows(painter, [box], false);
  paintBackgrounds(painter, [box], contextZ);
  paintBoxShadows(painter, [box], true);
  paintBorders(painter, [box], contextZ);
}


async function paintRecursive(painter: PagePainter, box: RenderBox, zForLogging: number): Promise<void> {
  if (box.establishesStackingContext) {
    paintBoxDecorations(painter, box, zForLogging);
  }

  const positionedChildren = box.children.filter(c => c.positioning.type !== 'normal');
  const inFlowChildren = box.children.filter(c => c.positioning.type === 'normal');

  const indexedPositioned = positionedChildren.map((child, index) => ({ child, index }));
  indexedPositioned.sort((a, b) => {
    const zA = a.child.stackingContext?.zIndex;
    const zB = b.child.stackingContext?.zIndex;
    const valA = typeof zA === 'number' ? zA : 0;
    const valB = typeof zB === 'number' ? zB : 0;
    if (valA !== valB) return valA - valB;
    return a.index - b.index;
  });
  const sortedPositionedChildren = indexedPositioned.map(item => item.child);

  const processChild = async (child: RenderBox, isPositioned: boolean) => {
    const childZ = child.stackingContext?.zIndex;
    const childZVal = typeof childZ === 'number' ? childZ : 0;
    const childZForLogging = box.establishesStackingContext ? zForLogging : (isPositioned ? childZVal : 0);
    await paintRecursive(painter, child, childZForLogging);
  };

  for (const child of sortedPositionedChildren) {
    const val = typeof child.stackingContext?.zIndex === 'number' ? child.stackingContext.zIndex : 0;
    if (val < 0) await processChild(child, true);
  }

  if (!box.establishesStackingContext) {
    paintBoxDecorations(painter, box, zForLogging);
  }

  for (const child of inFlowChildren) {
    await processChild(child, false);
  }

  await paintBoxContent(painter, box);

  for (const child of sortedPositionedChildren) {
    const val = typeof child.stackingContext?.zIndex === 'number' ? child.stackingContext.zIndex : 0;
    if (val >= 0) await processChild(child, true);
  }
}

async function paintText(painter: PagePainter, boxes: RenderBox[]): Promise<void> {
  for (const box of boxes) {
    for (const run of box.textRuns) {
      await painter.drawTextRun(run);
    }
  }
}

function paintBackgrounds(painter: PagePainter, boxes: RenderBox[], contextZ: number): void {
  for (const box of boxes) {
    const background = box.background;
    if (!background) {
      continue;
    }
    log("PAINT_TRACE", "TRACE", `op=fill id=${box.htmlId ?? box.id} z=${contextZ}`, { background });

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

function paintBorders(painter: PagePainter, boxes: RenderBox[], contextZ: number): void {
  for (const box of boxes) {
    const color = box.borderColor;
    if (!color) {
      continue;
    }
    log("PAINT_TRACE", "TRACE", `op=stroke id=${box.htmlId ?? box.id} z=${contextZ}`, { border: box.border, color });
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
