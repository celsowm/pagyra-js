import { pickFooterVariant, pickHeaderVariant, paintHeaderFooter, type HeaderFooterLayout } from "../header-footer.js";
import { PagePainter, type PainterResult } from "../page-painter.js";
import type { FontRegistry } from "../font/font-registry.js";
import { LayerMode, NodeKind } from "../types.js";
import type { LayoutPageTree, PageSize, Radius, RenderBox, RGBA, Rect, TextPaintOptions } from "../types.js";
import { paintBoxShadows } from "./paint-box-shadows.js";
import { shrinkRadius } from "./radius.js";
import { renderSvgBox } from "../svg/render-svg.js";
import { log } from "../../debug/log.js";

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
    await paintHeaderFooter(
      painter,
      headerVariant,
      footerVariant,
      tokens,
      pageNumber,
      totalPages,
      headerFooterTextOptions,
      true,
    );
  }

  // Paint each box as an atomic unit in the resolved paint order.
  for (const box of pageTree.paintOrder) {
    await paintBoxAtomic(painter, box);
  }

  if (headerFooterLayout.layerMode === LayerMode.Over) {
    await paintHeaderFooter(
      painter,
      headerVariant,
      footerVariant,
      tokens,
      pageNumber,
      totalPages,
      headerFooterTextOptions,
      false,
    );
  }

  return painter.result();
}


async function paintText(painter: PagePainter, box: RenderBox): Promise<void> {
  if (!box.textRuns || box.textRuns.length === 0) {
    return;
  }
  for (const run of box.textRuns) {
    // Merge box-level text shadows into the run so the renderer sees both.
    if (box.textShadows && box.textShadows.length > 0) {
      run.textShadows = [...(box.textShadows ?? []), ...(run.textShadows ?? [])];
    }
    await painter.drawTextRun(run);
  }
}

function paintBackground(painter: PagePainter, box: RenderBox): void {
  const background = box.background;
  if (!background) {
    return;
  }

  const paintArea = determineBackgroundPaintArea(box);
  if (!paintArea) {
    return;
  }

  // Log paint information for debugging z-index order
  log("PAINT", "DEBUG", `painting background z:${box.zIndexComputed ?? 0}`, {
    tagName: box.tagName,
    zIndex: box.zIndexComputed ?? 0,
    id: box.id,
    background: background.color
      ? "color"
      : background.gradient
      ? "gradient"
      : background.image
      ? "image"
      : "none",
  });

  if (background.color) {
    painter.fillRoundedRect(paintArea.rect, paintArea.radius, background.color);
  }

  if (background.gradient) {
    const clipRect = paintArea.rect;
    const patternRect = background.gradient.rect ?? clipRect;
    const offsetX = patternRect.x - clipRect.x;
    const offsetY = patternRect.y - clipRect.y;
    const scaleX = clipRect.width !== 0 ? patternRect.width / clipRect.width : 1;
    const scaleY = clipRect.height !== 0 ? patternRect.height / clipRect.height : 1;
    const needsOffset = Math.abs(offsetX) > 0.01 || Math.abs(offsetY) > 0.01;
    const needsScale = Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01;
    let gradientPaint: any = background.gradient.gradient;
    if (needsOffset || needsScale) {
      gradientPaint = { ...background.gradient.gradient };
      if (needsOffset) {
        gradientPaint.renderOffset = { x: offsetX, y: offsetY };
      }
      if (needsScale) {
        gradientPaint.renderScale = { x: scaleX, y: scaleY };
      }
    }
    painter.fillRoundedRect(clipRect, paintArea.radius, gradientPaint as any);
  }

  if (background.image) {
    paintBackgroundImageLayer(painter, background.image, paintArea.rect, paintArea.radius);
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

function paintBorder(painter: PagePainter, box: RenderBox): void {
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

async function paintSvg(painter: PagePainter, box: RenderBox): Promise<void> {
  if (box.kind === NodeKind.Svg || (box.tagName === "svg" && box.customData?.svg)) {
    await renderSvgBox(painter, box);
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

/**
 * Paint a single box as an atomic unit:
 * - box shadows
 * - background
 * - border
 * - image/svg/text content
 *
 * This uses the already-resolved pageTree.paintOrder for stacking,
 * so there is no global cross-element phase ordering here.
 */
async function paintBoxAtomic(painter: PagePainter, box: RenderBox): Promise<void> {
  console.log(`DEBUG: paintBoxAtomic - tagName: ${box.tagName}, id: ${box.id}, opacity: ${box.opacity}, transform: ${box.transform ? 'yes' : 'no'}`);
  log("PAINT", "DEBUG", `paintBoxAtomic: ${box.tagName} id:${box.id} opacity:${box.opacity}`, { id: box.id, opacity: box.opacity });
  
  const hasTransform = box.transform && (box.transform.b !== 0 || box.transform.c !== 0);
  const hasOpacity = box.opacity < 1;
  
  // If we have a transform, wrap everything in a transform context
  if (hasTransform) {
    painter.beginTransformScope(box.transform!, box.borderBox);
  }
  
  if (hasOpacity) {
    painter.beginOpacityScope(box.opacity);
  }

  // Shadows under background
  paintBoxShadows(painter, [box], false);

  // Background and border
  paintBackground(painter, box);
  paintBorder(painter, box);

  // Shadows above background/border if any
  paintBoxShadows(painter, [box], true);

  // Content: svg, images, text
  if (box.kind === NodeKind.Svg || (box.tagName === "svg" && box.customData?.svg)) {
    await paintSvg(painter, box);
  } else if (box.image) {
    painter.drawImage(box.image, box.contentBox);
  }

  await paintText(painter, box);

  if (hasOpacity) {
    painter.endOpacityScope(box.opacity);
  }
  
  if (hasTransform) {
    painter.endTransformScope();
  }
}
