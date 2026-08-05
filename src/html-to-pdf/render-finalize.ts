import { FontEmbedder } from "../pdf/font/embedder.js";
import { PdfDocument } from "../pdf/primitives/pdf-document.js";
import type { FontConfig } from "../types/fonts.js";
import { applyTextLayoutAdjustments } from "../pdf/utils/text-layout-adjuster.js";
import { buildRenderTree } from "../pdf/layout-tree-builder.js";
import type { PageFlowMetrics } from "../layout/fragmentation/page-flow.js";
import {
  applyBreakInsideAvoidWithPageFlow,
  applyPageFlowOffsets,
} from "../render/page-flow-offset.js";

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
  pageFlow: PageFlowMetrics;
  debug: boolean;
}

export function finalizeRenderTreePositioning(options: FinalizeRenderTreePositioningOptions): void {
  const { renderTree, pageFlow, debug } = options;
  applyTextLayoutAdjustments(renderTree.root);
  applyBreakInsideAvoidWithPageFlow(renderTree.root, pageFlow);
  applyPageFlowOffsets(renderTree.root, pageFlow, debug);
}
