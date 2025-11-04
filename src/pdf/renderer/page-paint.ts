import { pickFooterVariant, pickHeaderVariant, paintHeaderFooter, type HeaderFooterLayout } from "../header-footer.js";
import { PagePainter, type PainterResult } from "../page-painter.js";
import type { FontRegistry } from "../font/font-registry.js";
import { LayerMode, NodeKind } from "../types.js";
import type { LayoutPageTree, PageSize, RenderBox, RGBA, Rect, TextPaintOptions } from "../types.js";
import { paintBoxShadows } from "./paint-box-shadows.js";
import { renderSvgBox } from "../svg/render-svg.js";
import { sortBoxesByZIndex } from "./sort-by-z-index.js";
import { paintSingleBackground, paintSingleBorder } from "./paint-utils.js";

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

function flattenBoxTree(root: RenderBox): RenderBox[] {
  const result: RenderBox[] = [];
  const queue = [root];
  while (queue.length > 0) {
    const box = queue.shift();
    if (box) {
      result.push(box);
      queue.push(...box.children);
    }
  }
  return result;
}

async function paintBox(painter: PagePainter, box: RenderBox): Promise<void> {
  paintBoxShadows(painter, [box], false); // Inset shadows
  paintSingleBackground(painter, box);
  paintBoxShadows(painter, [box], true); // Outset shadows
  paintSingleBorder(painter, box);

  if (box.kind === NodeKind.Svg || (box.tagName === "svg" && box.customData?.svg)) {
    await renderSvgBox(painter, box);
  }

  if (box.image) {
    painter.drawImage(box.image, box.contentBox);
  }

  for (const run of box.textRuns) {
    await painter.drawTextRun(run);
  }
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

  const allBoxes = flattenBoxTree(pageTree.root);
  const sortedBoxes = sortBoxesByZIndex(allBoxes);

  for (const box of sortedBoxes) {
    await paintBox(painter, box);
  }

  if (headerFooterLayout.layerMode === LayerMode.Over) {
    await paintHeaderFooter(painter, headerVariant, footerVariant, tokens, pageNumber, totalPages, headerFooterTextOptions, false);
  }

  return painter.result();
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
