import { PdfDocument } from "./primitives/pdf-document.js";
import { initHeaderFooterContext, layoutHeaderFooterTrees, adjustPageBoxForHf, computeHfTokens, pickHeaderVariant, pickFooterVariant, paintHeaderFooter, } from "./header-footer.js";
import { paginateTree } from "./pagination.js";
import { PagePainter } from "./page-painter.js";
import { initFontSystem, finalizeFontSubsets, preflightFontsForPdfa } from "./font/font-registry.js";
import { LayerMode } from "./types.js";
const DEFAULT_PAGE_SIZE = { widthPt: 595.28, heightPt: 841.89 }; // A4 in points
export async function renderPdf(layout, options = {}) {
    const pageSize = options.pageSize ?? derivePageSize(layout);
    const pxToPt = createPxToPt(layout.dpiAssumption);
    const ptToPx = createPtToPx(layout.dpiAssumption);
    const doc = new PdfDocument(options.metadata ?? {});
    const fontRegistry = initFontSystem(doc, layout.css);
    // Initialize font embedding if fontConfig provided
    if (options.fontConfig) {
        await fontRegistry.initializeEmbedder(options.fontConfig);
    }
    preflightFontsForPdfa(fontRegistry);
    const baseContentBox = computeBaseContentBox(layout.root, pageSize, pxToPt);
    const hfContext = initHeaderFooterContext(layout.hf, pageSize, baseContentBox);
    const hfLayout = layoutHeaderFooterTrees(hfContext, pxToPt);
    const pageBox = adjustPageBoxForHf(baseContentBox, hfLayout);
    void pageBox;
    const pageHeightPx = ptToPx(pageSize.heightPt) || 1;
    const pages = paginateTree(layout.root, { pageHeight: pageHeightPx });
    const totalPages = pages.length;
    const tokens = computeHfTokens(layout.hf.placeholders ?? {}, totalPages, options.metadata);
    const headerFooterTextOptions = { fontSizePt: 10, fontFamily: layout.hf.fontFamily };
    for (let index = 0; index < pages.length; index++) {
        const pageTree = pages[index];
        const pageNumber = index + 1;
        const painter = new PagePainter(pageSize.heightPt, pxToPt, fontRegistry, pageTree.pageOffsetY);
        const headerVariant = pickHeaderVariant(hfLayout, pageNumber, totalPages);
        const footerVariant = pickFooterVariant(hfLayout, pageNumber, totalPages);
        if (layout.hf.layerMode === LayerMode.Under) {
            await paintHeaderFooter(painter, headerVariant, footerVariant, tokens, pageNumber, totalPages, headerFooterTextOptions, true);
        }
        paintBackgrounds(painter, pageTree.paintOrder);
        paintBorders(painter, pageTree.paintOrder);
        await paintText(painter, pageTree.flowContentOrder);
        if (layout.hf.layerMode === LayerMode.Over) {
            await paintHeaderFooter(painter, headerVariant, footerVariant, tokens, pageNumber, totalPages, headerFooterTextOptions, false);
        }
        const result = painter.result();
        doc.addPage({
            width: pageSize.widthPt,
            height: pageSize.heightPt,
            contents: result.content,
            resources: { fonts: result.fonts },
            annotations: [],
        });
    }
    finalizeFontSubsets(fontRegistry);
    return doc.finalize();
}
async function paintText(painter, boxes) {
    for (const box of boxes) {
        for (const run of box.textRuns) {
            await painter.drawTextRun(run);
        }
    }
}
function paintBackgrounds(painter, boxes) {
    for (const box of boxes) {
        const color = box.background?.color;
        if (color) {
            painter.fillRect(box.paddingBox ?? box.contentBox, color);
        }
    }
}
function paintBorders(painter, boxes) {
    for (const box of boxes) {
        const color = box.borderColor;
        if (!color) {
            continue;
        }
        const { border } = box;
        if (border.top > 0) {
            painter.fillRect({
                x: box.borderBox.x,
                y: box.borderBox.y,
                width: box.borderBox.width,
                height: border.top,
            }, color);
        }
        if (border.bottom > 0) {
            painter.fillRect({
                x: box.borderBox.x,
                y: box.borderBox.y + Math.max(box.borderBox.height - border.bottom, 0),
                width: box.borderBox.width,
                height: border.bottom,
            }, color);
        }
        if (border.left > 0) {
            painter.fillRect({
                x: box.borderBox.x,
                y: box.borderBox.y,
                width: border.left,
                height: box.borderBox.height,
            }, color);
        }
        if (border.right > 0) {
            painter.fillRect({
                x: box.borderBox.x + Math.max(box.borderBox.width - border.right, 0),
                y: box.borderBox.y,
                width: border.right,
                height: box.borderBox.height,
            }, color);
        }
    }
}
function createPxToPt(dpi) {
    const safeDpi = dpi > 0 ? dpi : 96;
    const factor = 72 / safeDpi;
    return (px) => px * factor;
}
function createPtToPx(dpi) {
    const safeDpi = dpi > 0 ? dpi : 96;
    const factor = safeDpi / 72;
    return (pt) => pt * factor;
}
function derivePageSize(layout) {
    const widthPt = layout.root.contentBox.width > 0 ? createPxToPt(layout.dpiAssumption)(layout.root.contentBox.width) : DEFAULT_PAGE_SIZE.widthPt;
    const heightPt = layout.root.contentBox.height > 0 ? createPxToPt(layout.dpiAssumption)(layout.root.contentBox.height) : DEFAULT_PAGE_SIZE.heightPt;
    return { widthPt, heightPt };
}
function computeBaseContentBox(root, pageSize, pxToPt) {
    const widthPx = root.contentBox.width > 0 ? root.contentBox.width : pageSize.widthPt / pxToPt(1);
    const heightPx = root.contentBox.height > 0 ? root.contentBox.height : pageSize.heightPt / pxToPt(1);
    return {
        x: root.contentBox.x,
        y: root.contentBox.y,
        width: widthPx,
        height: heightPx,
    };
}
