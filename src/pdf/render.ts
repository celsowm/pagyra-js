import { PdfDocument } from "./primitives/pdf-document.js";
import type { PdfObjectRef } from "./primitives/pdf-document.js";
import type { LayoutTree, PageSize, PdfMetadata, RenderBox, Radius, Edges, Rect, ShadowLayer, RGBA, TextPaintOptions } from "./types.js";
import {
  initHeaderFooterContext,
  layoutHeaderFooterTrees,
  adjustPageBoxForHf,
  computeHfTokens,
  pickHeaderVariant,
  pickFooterVariant,
  paintHeaderFooter,
} from "./header-footer.js";
import { paginateTree } from "./pagination.js";
import { PagePainter } from "./page-painter.js";
import { initFontSystem, finalizeFontSubsets, preflightFontsForPdfa } from "./font/font-registry.js";
import { LayerMode } from "./types.js";
import type { FontConfig } from "../types/fonts.js";

const DEFAULT_PAGE_SIZE: PageSize = { widthPt: 595.28, heightPt: 841.89 }; // A4 in points

export interface RenderPdfOptions {
  readonly pageSize?: PageSize;
  readonly metadata?: PdfMetadata;
  readonly fontConfig?: FontConfig;
}

export async function renderPdf(layout: LayoutTree, options: RenderPdfOptions = {}): Promise<Uint8Array> {
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
  const pageWidthPx = ptToPx(pageSize.widthPt) || 1;
  const pages = paginateTree(layout.root, { pageHeight: pageHeightPx });
  const totalPages = pages.length;
  const tokens = computeHfTokens(layout.hf.placeholders ?? {}, totalPages, options.metadata);
  const pageBackground = resolvePageBackground(layout.root);

  const headerFooterTextOptions: TextPaintOptions = { fontSizePt: 10, fontFamily: layout.hf.fontFamily };

  for (let index = 0; index < pages.length; index++) {
    const pageTree = pages[index];
    const pageNumber = index + 1;
    const painter = new PagePainter(pageSize.heightPt, pxToPt, fontRegistry, pageTree.pageOffsetY);

    const headerVariant = pickHeaderVariant(hfLayout, pageNumber, totalPages);
    const footerVariant = pickFooterVariant(hfLayout, pageNumber, totalPages);

    paintPageBackground(painter, pageBackground, pageWidthPx, pageHeightPx, pageTree.pageOffsetY);

    if (layout.hf.layerMode === LayerMode.Under) {
      await paintHeaderFooter(painter, headerVariant, footerVariant, tokens, pageNumber, totalPages, headerFooterTextOptions, true);
    }

    paintBoxShadows(painter, pageTree.paintOrder, false);
    paintBackgrounds(painter, pageTree.paintOrder);
    paintBoxShadows(painter, pageTree.paintOrder, true);
    paintBorders(painter, pageTree.paintOrder);
    paintImages(painter, pageTree.flowContentOrder);
    await paintText(painter, pageTree.flowContentOrder);

    if (layout.hf.layerMode === LayerMode.Over) {
      await paintHeaderFooter(painter, headerVariant, footerVariant, tokens, pageNumber, totalPages, headerFooterTextOptions, false);
    }

    const result = painter.result();
    const xObjects = new Map<string, PdfObjectRef>();
    for (const image of result.images) {
      const ref = doc.registerImage(image.image);
      image.ref = ref;
      xObjects.set(image.alias, ref);
    }
    const extGStates = new Map<string, PdfObjectRef>();
    for (const [name, alpha] of result.graphicsStates) {
      const ref = doc.registerExtGState(alpha);
      extGStates.set(name, ref);
    }
    doc.addPage({
      width: pageSize.widthPt,
      height: pageSize.heightPt,
      contents: result.content,
      resources: { fonts: result.fonts, xObjects, extGStates },
      annotations: [],
    });
  }

  finalizeFontSubsets(fontRegistry);
  return doc.finalize();
}

async function paintText(painter: PagePainter, boxes: RenderBox[]): Promise<void> {
  for (const box of boxes) {
    for (const run of box.textRuns) {
      await painter.drawTextRun(run);
    }
  }
}

function paintBoxShadows(painter: PagePainter, boxes: RenderBox[], inset: boolean): void {
  for (const box of boxes) {
    if (!box.boxShadows?.length) {
      continue;
    }
    for (const shadow of box.boxShadows) {
      if (shadow.inset !== inset) {
        continue;
      }
      if (!isRenderableShadow(shadow)) {
        continue;
      }
      if (inset) {
        renderInsetShadow(painter, box, shadow);
      } else {
        renderOuterShadow(painter, box, shadow);
      }
    }
  }
}

function isRenderableShadow(shadow: ShadowLayer): boolean {
  const alpha = clampUnit(shadow.color.a ?? 1);
  return alpha > 0;
}

function renderOuterShadow(painter: PagePainter, box: RenderBox, shadow: ShadowLayer): void {
  const baseRect = translateRect(box.borderBox, shadow.offsetX, shadow.offsetY);
  const baseRadius = cloneRadius(box.borderRadius);
  const blur = clampNonNegative(shadow.blur);
  const spread = shadow.spread;
  drawShadowLayers(painter, {
    mode: "outer",
    baseRect,
    baseRadius,
    color: shadow.color,
    blur,
    spread,
  });
}

function renderInsetShadow(painter: PagePainter, box: RenderBox, shadow: ShadowLayer): void {
  const container = box.paddingBox ?? box.contentBox;
  if (!container) {
    return;
  }
  const baseRect = translateRect(container, shadow.offsetX, shadow.offsetY);
  const baseRadius = shrinkRadius(cloneRadius(box.borderRadius), box.border.top, box.border.right, box.border.bottom, box.border.left);
  const blur = clampNonNegative(shadow.blur);
  const spread = shadow.spread;
  if (blur === 0 && spread === 0) {
    painter.fillRoundedRect(baseRect, baseRadius, shadow.color);
    return;
  }
  drawShadowLayers(painter, {
    mode: "inset",
    baseRect,
    baseRadius,
    color: shadow.color,
    blur,
    spread,
  });
}

interface ShadowRenderParams {
  mode: "outer" | "inset";
  baseRect: Rect;
  baseRadius: Radius;
  color: RGBA;
  blur: number;
  spread: number;
}

function drawShadowLayers(painter: PagePainter, params: ShadowRenderParams): void {
  const { mode, baseRect, baseRadius, color, blur, spread } = params;
  const steps = blur > 0 ? Math.max(2, Math.ceil(blur / 2)) : 1;
  const weights = buildShadowWeights(steps);
  const baseAlpha = clampUnit(color.a ?? 1);
  for (let index = 0; index < steps; index++) {
    const fraction =
      steps === 1
        ? 0
        : mode === "outer"
          ? index / (steps - 1)
          : (index + 1) / steps;
    const expansion = spread + blur * fraction;
    const weight = weights[index] ?? 0;
    if (weight <= 0) {
      continue;
    }
    const stepColor: RGBA = { r: color.r, g: color.g, b: color.b, a: clampUnit(baseAlpha * weight) };
    if (mode === "outer") {
      const rect = inflateRect(baseRect, expansion);
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }
      const radius = adjustRadius(baseRadius, expansion);
      painter.fillRoundedRect(rect, radius, stepColor);
    } else {
      const contraction = Math.max(0, expansion);
      const innerRect = inflateRect(baseRect, -contraction);
      if (innerRect.width <= 0 || innerRect.height <= 0) {
        continue;
      }
      const outerRadius = cloneRadius(baseRadius);
      const innerRadius = adjustRadius(baseRadius, -contraction);
      painter.fillRoundedRectDifference(baseRect, outerRadius, innerRect, innerRadius, stepColor);
    }
  }
}

function translateRect(rect: Rect, dx: number, dy: number): Rect {
  return { x: rect.x + dx, y: rect.y + dy, width: rect.width, height: rect.height };
}

function inflateRect(rect: Rect, amount: number): Rect {
  const width = rect.width + amount * 2;
  const height = rect.height + amount * 2;
  if (width <= 0 || height <= 0) {
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      width: 0,
      height: 0,
    };
  }
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width,
    height,
  };
}

function adjustRadius(radius: Radius, delta: number): Radius {
  const result = cloneRadius(radius);
  result.topLeft.x = clampNonNegative(result.topLeft.x + delta);
  result.topLeft.y = clampNonNegative(result.topLeft.y + delta);
  result.topRight.x = clampNonNegative(result.topRight.x + delta);
  result.topRight.y = clampNonNegative(result.topRight.y + delta);
  result.bottomRight.x = clampNonNegative(result.bottomRight.x + delta);
  result.bottomRight.y = clampNonNegative(result.bottomRight.y + delta);
  result.bottomLeft.x = clampNonNegative(result.bottomLeft.x + delta);
  result.bottomLeft.y = clampNonNegative(result.bottomLeft.y + delta);
  return result;
}

function cloneRadius(radius: Radius): Radius {
  return {
    topLeft: { x: radius.topLeft.x, y: radius.topLeft.y },
    topRight: { x: radius.topRight.x, y: radius.topRight.y },
    bottomRight: { x: radius.bottomRight.x, y: radius.bottomRight.y },
    bottomLeft: { x: radius.bottomLeft.x, y: radius.bottomLeft.y },
  };
}

function buildShadowWeights(steps: number): number[] {
  if (steps <= 1) {
    return [1];
  }
  const weights: number[] = [];
  let total = 0;
  for (let index = 0; index < steps; index++) {
    const weight = steps - index;
    weights.push(weight);
    total += weight;
  }
  return weights.map((weight) => weight / total);
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
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

function paintBackgrounds(painter: PagePainter, boxes: RenderBox[]): void {
  for (const box of boxes) {
    const color = box.background?.color;
    if (color) {
      // For table cells, fill the entire borderBox
      const isTableCell = box.tagName === 'td' || box.tagName === 'th';
      if (isTableCell) {
        painter.fillRoundedRect(box.borderBox, box.borderRadius, color);
        continue;
      }
      const targetRect = box.paddingBox ?? box.contentBox;
      if (!targetRect) {
        continue;
      }
      let targetRadius = shrinkRadius(box.borderRadius, box.border.top, box.border.right, box.border.bottom, box.border.left);
      if (targetRect === box.contentBox) {
        targetRadius = shrinkRadius(
          targetRadius,
          box.padding.top,
          box.padding.right,
          box.padding.bottom,
          box.padding.left,
        );
      }
      painter.fillRoundedRect(targetRect, targetRadius, color);
    }
  }
}

function paintBorders(painter: PagePainter, boxes: RenderBox[]): void {
  for (const box of boxes) {
    // Default to black if borderColor is not set and this is a table cell
    let color = box.borderColor;
    const isTableCell = box.tagName === 'td' || box.tagName === 'th';
    if (!color && isTableCell) {
      color = { r: 0, g: 0, b: 0, a: 1 };
    }
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

function shrinkRadius(radii: Radius, top: number, right: number, bottom: number, left: number): Radius {
  return {
    topLeft: {
      x: clampRadiusComponent(radii.topLeft.x - top),
      y: clampRadiusComponent(radii.topLeft.y - left),
    },
    topRight: {
      x: clampRadiusComponent(radii.topRight.x - top),
      y: clampRadiusComponent(radii.topRight.y - right),
    },
    bottomRight: {
      x: clampRadiusComponent(radii.bottomRight.x - bottom),
      y: clampRadiusComponent(radii.bottomRight.y - right),
    },
    bottomLeft: {
      x: clampRadiusComponent(radii.bottomLeft.x - bottom),
      y: clampRadiusComponent(radii.bottomLeft.y - left),
    },
  };
}

function clampRadiusComponent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value > 0 ? value : 0;
}

function hasVisibleBorder(border: Edges): boolean {
  return border.top > 0 || border.right > 0 || border.bottom > 0 || border.left > 0;
}

function paintImages(painter: PagePainter, boxes: RenderBox[]): void {
  for (const box of boxes) {
    if (box.image) {
      painter.drawImage(box.image, box.contentBox);
    }
  }
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
