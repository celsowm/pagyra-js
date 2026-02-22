import { FontEmbedder } from "../pdf/font/embedder.js";
import { PdfDocument } from "../pdf/primitives/pdf-document.js";
import type { FontConfig } from "../types/fonts.js";
import type { HeaderFooterHTML } from "../pdf/types.js";
import { applyPageVerticalMarginsWithHf, offsetRenderTree } from "../render/offset.js";
import { applyTextLayoutAdjustments } from "../pdf/utils/text-layout-adjuster.js";
import { buildRenderTree } from "../pdf/layout-tree-builder.js";
import type { PageMarginsPx } from "../units/page-utils.js";

export async function initializeFontEmbedder(fontConfig: FontConfig | undefined): Promise<FontEmbedder | null> {
  if (!fontConfig) {
    return null;
  }

  const pdfDoc = new PdfDocument();
  const fontEmbedder = new FontEmbedder(fontConfig, pdfDoc);
  await fontEmbedder.initialize();
  return fontEmbedder;
}

interface FinalizeRenderTreePositioningOptions {
  renderTree: ReturnType<typeof buildRenderTree>;
  resolvedHeaderFooter: Partial<HeaderFooterHTML> | undefined;
  pageHeight: number;
  marginsPx: PageMarginsPx;
  debug: boolean;
}

export function finalizeRenderTreePositioning(options: FinalizeRenderTreePositioningOptions): void {
  const { renderTree, resolvedHeaderFooter, pageHeight, marginsPx, debug } = options;
  applyTextLayoutAdjustments(renderTree.root);

  const headerHeightPx = resolvedHeaderFooter?.maxHeaderHeightPx ?? 0;
  const footerHeightPx = resolvedHeaderFooter?.maxFooterHeightPx ?? 0;
  applyPageVerticalMarginsWithHf(renderTree.root, {
    pageHeight,
    margins: marginsPx,
    headerHeightPx,
    footerHeightPx,
  });
  offsetRenderTree(renderTree.root, marginsPx.left, 0, debug);
}

