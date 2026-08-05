/**
 * Header/Footer Renderer
 *
 * This module provides Word/mPDF-like header and footer rendering.
 * Headers and footers are rendered as full HTML through the same layout pipeline
 * as the main content, giving them full styling capabilities.
 *
 * Key behaviors:
 * - Headers are rendered at the top of each page (within top margin area)
 * - Footers are rendered at the bottom of each page (within bottom margin area)
 * - Main content area is automatically reduced to exclude header/footer space
 * - Placeholders like {{pageNumber}}, {{totalPages}}, {{date}} are supported
 */

import { parseHTML } from "linkedom";
import type { FontConfig } from "../types/fonts.js";
import { parseCss } from "../html/css/parse-css.js";
import { makeUnitParsers, type UnitCtx } from "../units/units.js";
import { LayoutNode } from "../dom/node.js";
import { ComputedStyle } from "../css/style.js";
import { layoutTree } from "../layout/pipeline/layout-tree.js";
import { buildRenderTree } from "./layout-tree-builder.js";
import type { RenderBox, LayoutTree, Run } from "./types.js";
import { convertDomNode } from "../html/dom-converter.js";
import { computeStyleForElement } from "../css/compute-style.js";
import { Display } from "../css/enums.js";
import { log } from "../logging/debug.js";
import { offsetRenderTree } from "../render/offset.js";
import type { FontEmbedder } from "./font/embedder.js";
import { FontRegistryResolver } from "../fonts/font-registry-resolver.js";
import type { FontRegistry } from "./font/font-registry.js";
import { computeGlyphRun, applyWordSpacingToGlyphRun } from "./utils/node-text-run-factory.js";
import type { PagePainter } from "./page-painter.js";
import { paintBoxAtomic } from "./renderer/box-painter.js";
import { applyPlaceholders } from "./header-footer-tokens.js";
import type { Environment } from "../environment/environment.js";
import { createCounterContext } from "../layout/counter.js";

export interface HeaderFooterRenderOptions {
  /** The HTML content for the header/footer */
  html: string;
  /** Optional CSS to apply */
  css?: string;
  /** Width of the header/footer area in pixels */
  widthPx: number;
  /** Maximum height of the header/footer area in pixels */
  maxHeightPx: number;
  /** Font configuration for rendering */
  fontConfig?: FontConfig;
  /** Font embedder for PDF output */
  fontEmbedder?: FontEmbedder | null;
  /** Resource base directory for loading assets */
  resourceBaseDir?: string;
  /** Asset root directory */
  assetRootDir?: string;
  /** Tokens for placeholder replacement */
  tokens?: Map<string, string | ((page: number, total: number) => string)>;
  /** Current page number (1-indexed) */
  pageNumber?: number;
  /** Total number of pages */
  totalPages?: number;
  /** Platform environment (Node/browser) for resource loading */
  environment?: Environment;
}

export interface RenderedHeaderFooter {
  /** The render tree for the header/footer */
  renderTree: LayoutTree;
  /** The actual height of the rendered content in pixels */
  heightPx: number;
  /** The root render box */
  root: RenderBox;
}

/**
 * Renders header or footer HTML into a layout tree.
 * This uses the same pipeline as the main content for full HTML/CSS support.
 */
export async function renderHeaderFooterHtml(
  options: HeaderFooterRenderOptions
): Promise<RenderedHeaderFooter | null> {
  const {
    html,
    css = "",
    widthPx,
    maxHeightPx,
    fontEmbedder,
    resourceBaseDir,
    assetRootDir,
    tokens,
    pageNumber = 1,
    totalPages = 1,
    environment,
  } = options;

  const resolvedResourceBase = resourceBaseDir ?? "";
  const resolvedAssetRoot = assetRootDir ?? resolvedResourceBase;

  if (!html || !html.trim()) {
    return null;
  }

  // Apply placeholder replacements
  let processedHtml = html;
  if (tokens) {
    processedHtml = applyPlaceholders(html, tokens, pageNumber, totalPages);
  }

  // Wrap in a container if not already a full document
  const normalizedHtml = normalizeHtmlFragment(processedHtml);

  const unitCtx: UnitCtx = { viewport: { width: widthPx, height: maxHeightPx } };
  const units = makeUnitParsers(unitCtx);

  const { document } = parseHTML(normalizedHtml);

  // Parse CSS in print mode using the header/footer viewport.
  const { styleRules: cssRules } = parseCss(css, {
    mediaType: "print",
    viewportWidth: widthPx,
    viewportHeight: maxHeightPx,
  });

  // Get the root element
  const rootElement = document.body || document.documentElement;

  const baseParentStyle = new ComputedStyle();
  const rootFontSize = baseParentStyle.fontSize;

  let rootStyle = computeStyleForElement(rootElement, cssRules, baseParentStyle, units, rootFontSize);
  if (isInlineDisplay(rootStyle.display)) {
    rootStyle.display = Display.Block;
  }

  const rootLayout = new LayoutNode(rootStyle, [], { tagName: rootElement?.tagName?.toLowerCase() });

  const counterContext = createCounterContext();
  const rootCounterScopeId = counterContext.registerScope(null);
  const conversionContext = {
    resourceBaseDir: resolvedResourceBase,
    assetRootDir: resolvedAssetRoot,
    units,
    rootFontSize,
    environment,
    counterContext,
    rootCounterScopeId,
  };

  if (rootElement) {
    for (const child of Array.from(rootElement.childNodes)) {
      if (child.nodeType === child.ELEMENT_NODE) {
        const tagName = (child as HTMLElement).tagName.toLowerCase();
        if (tagName === "head" || tagName === "meta" || tagName === "title" || tagName === "link" || tagName === "script") {
          continue;
        }
      }
      const layoutChild = await convertDomNode(child, cssRules, rootStyle, conversionContext);
      if (layoutChild) rootLayout.appendChild(layoutChild);
    }
  }

  // Layout with constrained dimensions
  layoutTree(rootLayout, { width: widthPx, height: maxHeightPx }, fontEmbedder ?? null);

  // Build render tree
  const renderTree = buildRenderTree(rootLayout);
  const root = renderTree.root;

  // Calculate actual content height
  const heightPx = calculateContentHeight(root);

  log("layout", "debug", "Header/footer rendered", {
    widthPx,
    maxHeightPx,
    actualHeightPx: heightPx,
  });

  return {
    renderTree,
    heightPx: Math.min(heightPx, maxHeightPx),
    root,
  };
}

/**
 * Paints a rendered header/footer onto a PDF page.
 */
export async function paintHeaderFooter(
  painter: PagePainter,
  rendered: RenderedHeaderFooter,
  options: {
    offsetX: number;
    offsetY: number;
    clipHeight?: number;
    fontRegistry: FontRegistry;
  }
): Promise<void> {
  const { offsetX, offsetY, clipHeight, fontRegistry } = options;

  // Clone and offset the render tree
  const clonedRoot = cloneRenderBox(rendered.root);
  offsetRenderTree(clonedRoot, offsetX, offsetY);

  // Paint all boxes in order
  const fontResolver = new FontRegistryResolver(fontRegistry);
  await paintRenderBoxTree(painter, clonedRoot, fontResolver, clipHeight);
}

/**
 * Calculate the actual content height of a render tree.
 */
function calculateContentHeight(root: RenderBox): number {
  let maxBottom = root.borderBox?.y ?? root.contentBox.y;

  function visit(box: RenderBox): void {
    const boxBottom = (box.borderBox?.y ?? box.contentBox.y) +
      (box.borderBox?.height ?? box.contentBox.height);
    maxBottom = Math.max(maxBottom, boxBottom);

    for (const child of box.children) {
      visit(child);
    }
  }

  visit(root);
  const rootTop = root.borderBox?.y ?? root.contentBox.y;
  return Math.max(0, maxBottom - rootTop);
}

/**
 * Paint render box tree recursively.
 */
async function paintRenderBoxTree(
  painter: PagePainter,
  box: RenderBox,
  fontResolver: FontRegistryResolver,
  clipHeight?: number
): Promise<void> {
  // Paint the box atomically (background, border, content)
  await paintBoxAtomic(painter, box, fontResolver);

  // Paint text runs
  for (const run of box.textRuns) {
    await paintTextRun(painter, run, fontResolver);
  }

  // Paint children
  for (const child of box.children) {
    if (clipHeight !== undefined) {
      const childY = child.borderBox?.y ?? child.contentBox.y;
      if (childY > clipHeight) continue;
    }
    await paintRenderBoxTree(painter, child, fontResolver, clipHeight);
  }
}

/**
 * Paint a text run.
 */
async function paintTextRun(
  painter: PagePainter,
  run: Run,
  fontResolver: FontRegistryResolver
): Promise<void> {
  const font = fontResolver.resolve(run.fontFamily, run.fontWeight, run.fontStyle);
  if (!font) {
    log("font", "warn", "Font not found for header/footer text", {
      family: run.fontFamily,
      weight: run.fontWeight,
      style: run.fontStyle,
    });
    return;
  }

  let glyphRun = computeGlyphRun(font, run.text, run.fontSize);
  if (run.wordSpacing && run.wordSpacing !== 0) {
    glyphRun = applyWordSpacingToGlyphRun(glyphRun, run.wordSpacing);
  }

  painter.drawTextRun({
    glyphRun,
    x: run.lineMatrix.e,
    y: run.lineMatrix.f,
    fontSize: run.fontSize,
    color: run.color,
    font,
  });
}

/**
 * Deep clone a render box tree.
 */
function cloneRenderBox(box: RenderBox): RenderBox {
  return {
    ...box,
    contentBox: { ...box.contentBox },
    borderBox: box.borderBox ? { ...box.borderBox } : undefined,
    paddingBox: box.paddingBox ? { ...box.paddingBox } : undefined,
    marginBox: box.marginBox ? { ...box.marginBox } : undefined,
    visualOverflow: box.visualOverflow ? { ...box.visualOverflow } : undefined,
    textRuns: box.textRuns.map((run) => ({
      ...run,
      lineMatrix: { ...run.lineMatrix },
    })),
    children: box.children.map(cloneRenderBox),
    links: box.links.map((link) => ({
      ...link,
      rect: { ...link.rect },
      target: { ...link.target },
    })),
  };
}

/**
 * Normalize an HTML fragment into a complete document.
 */
function normalizeHtmlFragment(html: string): string {
  const trimmed = html.trim();
  if (trimmed.toLowerCase().startsWith("<!doctype") || trimmed.toLowerCase().startsWith("<html")) {
    return trimmed;
  }
  return `<!DOCTYPE html><html><head></head><body>${trimmed}</body></html>`;
}

function isInlineDisplay(display: Display): boolean {
  return display === Display.Inline || display === Display.InlineBlock || display === Display.InlineFlex || display === Display.InlineGrid || display === Display.InlineTable;
}
