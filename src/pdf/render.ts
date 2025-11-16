import { PdfDocument } from "./primitives/pdf-document.js";
import type { LayoutTree, PageSize, PdfMetadata, RenderBox, RGBA, TextPaintOptions } from "./types.js";
import {
  initHeaderFooterContext,
  layoutHeaderFooterTrees,
  computeHfTokens,
} from "./header-footer.js";
import { paginateTree } from "./pagination.js";
import { initFontSystem, finalizeFontSubsets, preflightFontsForPdfa } from "./font/font-registry.js";
import type { FontConfig } from "../types/fonts.js";
import { paintLayoutPage } from "./renderer/page-paint.js";
import { loadBuiltinFontConfig } from "./font/builtin-fonts.js";
import { registerPageResources, type PageResources } from "./utils/page-resource-registrar.js";

const DEFAULT_PAGE_SIZE: PageSize = { widthPt: 595.28, heightPt: 841.89 }; // A4 in points

export interface RenderPdfOptions {
  readonly pageSize?: PageSize;
  readonly metadata?: PdfMetadata;
  readonly fontConfig?: FontConfig;
}

export async function renderPdf(layout: LayoutTree, options: RenderPdfOptions = {}): Promise<Uint8Array> {
  const fontConfig = options.fontConfig ?? (await loadBuiltinFontConfig());
  const pageSize = options.pageSize ?? derivePageSize(layout);
  const pxToPt = createPxToPt(layout.dpiAssumption);
  const ptToPx = createPtToPx(layout.dpiAssumption);
  const doc = new PdfDocument(options.metadata ?? {});
  const fontRegistry = initFontSystem(doc, layout.css);

  // Initialize font embedding if fontConfig provided
  if (fontConfig) {
    await fontRegistry.initializeEmbedder(fontConfig);
  }

  preflightFontsForPdfa(fontRegistry);

  const baseContentBox = computeBaseContentBox(layout.root, pageSize, pxToPt);
  const hfContext = initHeaderFooterContext(layout.hf, pageSize, baseContentBox);
  const hfLayout = layoutHeaderFooterTrees(hfContext, pxToPt);

  const pageHeightPx = ptToPx(pageSize.heightPt) || 1;
  const pageWidthPx = ptToPx(pageSize.widthPt) || 1;
  const pages = paginateTree(layout.root, { pageHeight: pageHeightPx });
  const totalPages = pages.length;
  const tokens = computeHfTokens(layout.hf.placeholders ?? {}, totalPages, options.metadata);
  const pageBackground = resolvePageBackground(layout.root);

  const headerFooterTextOptions: TextPaintOptions = { fontSizePt: 10, fontFamily: layout.hf.fontFamily };

  for (let index = 0; index < pages.length; index++) {
    const pageTree = pages[index];
    const pageNumber = index + 1;

    const painterResult = await paintLayoutPage({
      pageTree,
      pageNumber,
      totalPages,
      pageSize,
      pxToPt,
      pageWidthPx,
      pageHeightPx,
      fontRegistry,
      headerFooterLayout: hfLayout,
      tokens,
      headerFooterTextOptions,
      pageBackground,
    });

    const resources = registerPageResources(doc, painterResult);

    doc.addPage({
      width: pageSize.widthPt,
      height: pageSize.heightPt,
      contents: painterResult.content,
      resources,
      annotations: [],
    });
  }

  finalizeFontSubsets(fontRegistry);
  return doc.finalize();
}

function resolvePageBackground(root: RenderBox): RGBA | undefined {
  if (root.background?.color) {
    return root.background.color;
  }
  for (const child of root.children) {
    if (child.tagName === "body" || child.tagName === "html") {
      const candidate = child.background?.color;
      if (candidate) {
        return candidate;
      }
    }
  }
  return undefined;
}

function createPxToPt(dpi: number): (px: number) => number {
  const safeDpi = dpi > 0 ? dpi : 96;
  const factor = 72 / safeDpi;
  return (px: number) => px * factor;
}

function createPtToPx(dpi: number): (pt: number) => number {
  const safeDpi = dpi > 0 ? dpi : 96;
  const factor = safeDpi / 72;
  return (pt: number) => pt * factor;
}

function derivePageSize(layout: LayoutTree): PageSize {
  const widthPt = layout.root.contentBox.width > 0 ? createPxToPt(layout.dpiAssumption)(layout.root.contentBox.width) : DEFAULT_PAGE_SIZE.widthPt;
  const heightPt =
    layout.root.contentBox.height > 0 ? createPxToPt(layout.dpiAssumption)(layout.root.contentBox.height) : DEFAULT_PAGE_SIZE.heightPt;
  return { widthPt, heightPt };
}

function computeBaseContentBox(root: RenderBox, pageSize: PageSize, pxToPt: (px: number) => number) {
  const widthPx = root.contentBox.width > 0 ? root.contentBox.width : pageSize.widthPt / pxToPt(1);
  const heightPx = root.contentBox.height > 0 ? root.contentBox.height : pageSize.heightPt / pxToPt(1);
  return {
    x: root.contentBox.x,
    y: root.contentBox.y,
    width: widthPx,
    height: heightPx,
  };
}
