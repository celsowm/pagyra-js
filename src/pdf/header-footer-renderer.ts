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

  // Parse CSS
  const { styleRules: cssRules } = parseCss(css);

  // Get the root element
  const rootElement = document.body || document.documentElement;

  const baseParentStyle = new ComputedStyle();
  const rootFontSize = baseParentStyle.fontSize;

  let rootStyle = computeStyleForElement(rootElement, cssRules, baseParentStyle, units, rootFontSize);
  if (isInlineDisplay(rootStyle.display)) {
    rootStyle.display = Display.Block;
  }

  const rootLayout = new LayoutNode(rootStyle, [], { tagName: rootElement?.tagName?.toLowerCase() });

  const conversionContext = { resourceBaseDir: resolvedResourceBase, assetRootDir: resolvedAssetRoot, units, rootFontSize, environment };

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

  const renderTree = buildRenderTree(rootLayout, {});

  // Calculate actual height
  const actualHeight = Math.min(calculateTreeHeight(renderTree.root), maxHeightPx);

  log("layout", "debug", "Header/footer rendered", {
    widthPx,
    maxHeightPx,
    actualHeight,
    hasContent: renderTree.root.children.length > 0,
  });

  return {
    renderTree,
    heightPx: actualHeight,
    root: renderTree.root,
  };
}

/**
 * Deep clones a render box tree for per-page rendering.
 * This is needed because we apply offsets that are page-specific.
 */
function cloneRenderBox(box: RenderBox): RenderBox {
  const clonedRuns = box.textRuns.map((run) => ({
    ...run,
    lineMatrix: run.lineMatrix ? { ...run.lineMatrix } : undefined,
    decorations: run.decorations ? { ...run.decorations } : undefined,
    glyphs: run.glyphs ? { ...run.glyphs } : undefined,
  })) as Run[];

  const clonedBox: RenderBox = {
    ...box,
    contentBox: { ...box.contentBox },
    paddingBox: { ...box.paddingBox },
    borderBox: { ...box.borderBox },
    visualOverflow: { ...box.visualOverflow },
    padding: { ...box.padding },
    border: { ...box.border },
    borderRadius: {
      topLeft: { ...box.borderRadius.topLeft },
      topRight: { ...box.borderRadius.topRight },
      bottomRight: { ...box.borderRadius.bottomRight },
      bottomLeft: { ...box.borderRadius.bottomLeft },
    },
    background: box.background
      ? {
          color: box.background.color ? { ...box.background.color } : undefined,
          image: box.background.image
            ? {
                ...box.background.image,
                rect: { ...box.background.image.rect },
                originRect: { ...box.background.image.originRect },
              }
            : undefined,
          gradient: box.background.gradient
            ? {
                ...box.background.gradient,
                rect: { ...box.background.gradient.rect },
                originRect: { ...box.background.gradient.originRect },
              }
            : undefined,
        }
      : { color: undefined },
    textRuns: clonedRuns,
    markerRect: box.markerRect ? { ...box.markerRect } : undefined,
    boxShadows: box.boxShadows.map((s) => ({ ...s, color: { ...s.color } })),
    links: box.links.map((link) => ({
      rect: { ...link.rect },
      target: { ...link.target },
    })),
    children: box.children.map((child) => cloneRenderBox(child)),
  };

  return clonedBox;
}

/**
 * Paints a rendered header/footer onto a page.
 */
export async function paintRenderedHeaderFooter(
  painter: PagePainter,
  rendered: RenderedHeaderFooter,
  xOffsetPx: number,
  yOffsetPx: number,
  fontRegistry: FontRegistry,
  pageOffsetY: number,
): Promise<void> {
  // Clone the tree to avoid mutating the original
  const clonedRoot = cloneRenderBox(rendered.root);

  // Enrich text runs with glyph data
  const fontResolver = new FontRegistryResolver(fontRegistry);
  await enrichTreeWithGlyphRuns(clonedRoot, fontResolver);

  // Position header/footer in document-space for the current page. The page painter
  // will subtract pageOffsetY when converting to local page coordinates.
  offsetRenderTree(clonedRoot, xOffsetPx, yOffsetPx + pageOffsetY, false);

  // Paint all boxes
  const stack: RenderBox[] = [clonedRoot];
  while (stack.length > 0) {
    const box = stack.pop()!;
    await paintBoxAtomic(painter, box);
    // Add children in reverse order to paint in correct order
    for (let i = box.children.length - 1; i >= 0; i--) {
      stack.push(box.children[i]);
    }
  }
}

/**
 * Calculates the configuration for page content area when headers/footers are present.
 */
export interface PageContentAreaConfig {
  /** Y offset where content should start (after header) */
  contentStartY: number;
  /** Available height for content (excluding header and footer) */
  contentHeightPx: number;
  /** Y position where footer should be placed */
  footerY: number;
}

export function calculatePageContentArea(
  pageHeightPx: number,
  marginTop: number,
  marginBottom: number,
  headerHeightPx: number,
  footerHeightPx: number,
): PageContentAreaConfig {
  // Header is placed at marginTop
  // Content starts after header
  const contentStartY = marginTop + headerHeightPx;

  // Footer is placed at (pageHeight - marginBottom - footerHeight)
  const footerY = pageHeightPx - marginBottom - footerHeightPx;

  // Content height is the space between header and footer
  const contentHeightPx = footerY - contentStartY;

  return {
    contentStartY,
    contentHeightPx: Math.max(0, contentHeightPx),
    footerY,
  };
}

function normalizeHtmlFragment(html: string): string {
  const hasHtmlTag = /<\s*html[\s>]/i.test(html);
  if (hasHtmlTag) {
    return html;
  }
  return `<!doctype html><html><head></head><body>${html}</body></html>`;
}

function isInlineDisplay(display: Display): boolean {
  return (
    display === Display.Inline ||
    display === Display.InlineBlock ||
    display === Display.InlineFlex ||
    display === Display.InlineGrid ||
    display === Display.InlineTable
  );
}

function calculateTreeHeight(root: RenderBox): number {
  let maxBottom = 0;

  function traverse(box: RenderBox): void {
    const bottom = box.borderBox.y + box.borderBox.height;
    maxBottom = Math.max(maxBottom, bottom);
    for (const child of box.children) {
      traverse(child);
    }
  }

  traverse(root);
  return maxBottom;
}

async function enrichTreeWithGlyphRuns(root: RenderBox, fontResolver: FontRegistryResolver): Promise<void> {
  async function enrichRun(run: Run): Promise<void> {
    if (run.glyphs) {
      return;
    }
    try {
      const font = await fontResolver.resolve(run.fontFamily, run.fontWeight, run.fontStyle);
      const letterSpacing = run.letterSpacing ?? 0;
      const glyphRun = computeGlyphRun(font, run.text, run.fontSize, letterSpacing);
      applyWordSpacingToGlyphRun(glyphRun, run.text, run.wordSpacing);
      run.glyphs = glyphRun;
    } catch {
      // Ignore font resolution errors for headers/footers
    }
  }

  async function traverse(box: RenderBox): Promise<void> {
    if (box.textRuns && box.textRuns.length > 0) {
      for (const run of box.textRuns) {
        await enrichRun(run);
      }
    }
    for (const child of box.children) {
      await traverse(child);
    }
  }

  await traverse(root);
}
