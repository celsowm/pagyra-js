import { pickFooterVariant, pickHeaderVariant, paintHeaderFooter, type HeaderFooterLayout } from "../header-footer.js";
import type { HeaderFooterPaintContext } from "../header-footer-painter.js";
import { PagePainter, type PainterResult } from "../page-painter.js";
import type { FontRegistry } from "../font/font-registry.js";
import { LayerMode } from "../types.js";
import type { LayoutPageTree, PageSize, RGBA, TextPaintOptions } from "../types.js";
import type { PaintInstruction } from "../stacking/types.js";
import { paintBoxAtomic, paintPageBackground } from "./box-painter.js";
import type { Environment } from "../../environment/environment.js";

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
  readonly margins?: { top: number; right: number; bottom: number; left: number };
  readonly headerFooterCss?: string;
  readonly environment?: Environment;
  readonly resourceBaseDir?: string;
  readonly assetRootDir?: string;
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
  margins,
  headerFooterCss,
  environment,
  resourceBaseDir,
  assetRootDir,
}: PagePaintInput): Promise<PainterResult> {
  const painter = new PagePainter(pageSize.heightPt, pxToPt, fontRegistry, pageTree.pageOffsetY, environment);

  const headerVariant = pickHeaderVariant(headerFooterLayout, pageNumber, totalPages);
  const footerVariant = pickFooterVariant(headerFooterLayout, pageNumber, totalPages);

  paintPageBackground(painter, pageBackground, pageWidthPx, pageHeightPx, pageTree.pageOffsetY);

  const hfContext: HeaderFooterPaintContext | undefined = margins
    ? {
        margins,
        pageWidthPx,
        pageHeightPx,
        fontRegistry,
        pageOffsetY: pageTree.pageOffsetY,
        clipOverflow: headerFooterLayout.clipOverflow,
        css: headerFooterCss,
        environment,
        resourceBaseDir,
        assetRootDir,
      }
    : undefined;

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
      hfContext,
    );
  }

  for (const layer of pageTree.positionedLayersSortedByZ) {
    if (layer.z < 0) {
      await paintInstructions(painter, layer.paintOrder ?? boxesToInstructions(layer.boxes));
    }
  }

  await paintInstructions(painter, pageTree.paintOrder);

  for (const layer of pageTree.positionedLayersSortedByZ) {
    if (layer.z >= 0) {
      await paintInstructions(painter, layer.paintOrder ?? boxesToInstructions(layer.boxes));
    }
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
      hfContext,
    );
  }

  return painter.result();
}

async function paintInstructions(
  painter: PagePainter,
  instructions: readonly PaintInstruction[],
): Promise<void> {
  for (const instruction of instructions) {
    if (instruction.type === "beginOpacity") {
      painter.beginOpacityScope(instruction.opacity);
    } else if (instruction.type === "endOpacity") {
      painter.endOpacityScope(0);
    } else {
      await paintBoxAtomic(painter, instruction.box);
    }
  }
}

function boxesToInstructions(boxes: LayoutPageTree["flowContentOrder"]): PaintInstruction[] {
  return boxes.map((box) => ({ type: "box", box }));
}
