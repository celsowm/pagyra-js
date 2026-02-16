import type { TextPaintOptions } from "./types.js";
import type { PagePainter } from "./page-painter.js";
import type { HeaderFooterVariant } from "./header-footer-layout.js";
import type { FontRegistry } from "./font/font-registry.js";
import { applyPlaceholders } from "./header-footer-tokens.js";
import type { PathCommand } from "./renderers/shape-renderer.js";
import {
  renderHeaderFooterHtml,
  paintRenderedHeaderFooter,
} from "./header-footer-renderer.js";
// import { paintBoxAtomic } from "./renderer/box-painter.js";
import { log } from "../logging/debug.js";
import type { Environment } from "../environment/environment.js";

export interface HeaderFooterPaintContext {
  /** Page margins in pixels */
  margins: { top: number; right: number; bottom: number; left: number };
  /** Page width in pixels */
  pageWidthPx: number;
  /** Page height in pixels */
  pageHeightPx: number;
  /** Font registry for text rendering */
  fontRegistry: FontRegistry;
  /** Page offset Y for coordinate transformation */
  pageOffsetY: number;
  /** Whether header/footer paint should be clipped to max height area */
  clipOverflow?: boolean;
  /** Optional CSS for header/footer styling */
  css?: string;
  /** Platform environment (Node/browser) */
  environment?: Environment;
  /** Resource base directory for document-relative paths */
  resourceBaseDir?: string;
  /** Asset root directory for absolute paths like /images/foo.png */
  assetRootDir?: string;
}

/**
 * Renders and paints headers and footers as full HTML content.
 * This provides Word/mPDF-like behavior where headers and footers
 * are fully rendered HTML with complete styling support.
 */
export async function paintHeaderFooter(
  painter: PagePainter,
  header: HeaderFooterVariant | undefined,
  footer: HeaderFooterVariant | undefined,
  tokens: Map<string, string | ((page: number, total: number) => string)>,
  pageIndex: number,
  totalPages: number,
  baseOptions: TextPaintOptions = { fontSizePt: 10 },
  under = false,
  context?: HeaderFooterPaintContext,
): Promise<void> {
  void under;

  // If we have full context, use the new HTML rendering path
  if (context) {
    log("layout", "debug", "Using HTML rendering path for headers/footers", {
      hasHeader: !!header?.content,
      hasFooter: !!footer?.content,
      margins: context.margins,
    });
    await paintHeaderFooterWithContext(
      painter,
      header,
      footer,
      tokens,
      pageIndex,
      totalPages,
      context,
    );
    return;
  }

  log("layout", "debug", "Using legacy text rendering for headers/footers (no context)");
  // Fallback to legacy text-only rendering for backwards compatibility
  await paintHeaderFooterLegacy(painter, header, footer, tokens, pageIndex, totalPages, baseOptions);
}

/**
 * New HTML rendering path for headers/footers.
 * Renders headers and footers as full HTML through the layout pipeline.
 */
async function paintHeaderFooterWithContext(
  painter: PagePainter,
  header: HeaderFooterVariant | undefined,
  footer: HeaderFooterVariant | undefined,
  tokens: Map<string, string | ((page: number, total: number) => string)>,
  pageIndex: number,
  totalPages: number,
  context: HeaderFooterPaintContext,
): Promise<void> {
  const { margins, pageWidthPx, pageHeightPx, fontRegistry, pageOffsetY, clipOverflow = false, css, resourceBaseDir, assetRootDir } = context;

  // Calculate content width (page width minus left and right margins)
  const contentWidthPx = pageWidthPx - margins.left - margins.right;

  log("layout", "debug", "paintHeaderFooterWithContext", {
    headerContent: header?.content ? String(header.content).slice(0, 100) : "none",
    footerContent: footer?.content ? String(footer.content).slice(0, 100) : "none",
    contentWidthPx,
    pageWidthPx,
    pageHeightPx,
  });

  // Render and paint header
  if (header?.content) {
    const headerHtml = stringify(header.content);
    log("layout", "debug", "Rendering header HTML", { headerHtml: headerHtml.slice(0, 200) });
    if (headerHtml) {
      try {
        const rendered = await renderHeaderFooterHtml({
          html: headerHtml,
          css,
          widthPx: contentWidthPx,
          maxHeightPx: header.maxHeightPx,
          resourceBaseDir,
          assetRootDir,
          tokens,
          pageNumber: pageIndex,
          totalPages,
          environment: context.environment,
        });

        if (rendered) {
          log("layout", "debug", "Header rendered successfully", { heightPx: rendered.heightPx });
          const headerY = margins.top;
          const shouldClip = clipOverflow && header.maxHeightPx > 0 && contentWidthPx > 0;
          if (shouldClip) {
            const clipPath = buildRectClipPath({
              x: margins.left,
              y: headerY + pageOffsetY,
              width: contentWidthPx,
              height: header.maxHeightPx,
            });
            painter.beginClipPath(clipPath);
          }
          try {
            // Header is positioned at the top margin area
            await paintRenderedHeaderFooter(
              painter,
              rendered,
              margins.left,
              headerY,
              fontRegistry,
              pageOffsetY,
            );
          } finally {
            if (shouldClip) {
              painter.endClipPath();
            }
          }
        }
      } catch (err) {
        log("layout", "warn", "Failed to render header HTML", { error: err });
      }
    }
  }

  // Render and paint footer
  if (footer?.content) {
    const footerHtml = stringify(footer.content);
    if (footerHtml) {
      try {
        const rendered = await renderHeaderFooterHtml({
          html: footerHtml,
          css,
          widthPx: contentWidthPx,
          maxHeightPx: footer.maxHeightPx,
          resourceBaseDir,
          assetRootDir,
          tokens,
          pageNumber: pageIndex,
          totalPages,
          environment: context.environment,
        });

        if (rendered) {
          // Footer is positioned at the bottom of the page
          const footerY = pageHeightPx - margins.bottom - footer.maxHeightPx;
          const shouldClip = clipOverflow && footer.maxHeightPx > 0 && contentWidthPx > 0;
          if (shouldClip) {
            const clipPath = buildRectClipPath({
              x: margins.left,
              y: footerY + pageOffsetY,
              width: contentWidthPx,
              height: footer.maxHeightPx,
            });
            painter.beginClipPath(clipPath);
          }
          try {
            await paintRenderedHeaderFooter(
              painter,
              rendered,
              margins.left,
              footerY,
              fontRegistry,
              pageOffsetY,
            );
          } finally {
            if (shouldClip) {
              painter.endClipPath();
            }
          }
        }
      } catch (err) {
        log("layout", "warn", "Failed to render footer HTML", { error: err });
      }
    }
  }
}

/**
 * Legacy text-only rendering for headers/footers.
 * Used for backwards compatibility when context is not provided.
 */
async function paintHeaderFooterLegacy(
  painter: PagePainter,
  header: HeaderFooterVariant | undefined,
  footer: HeaderFooterVariant | undefined,
  tokens: Map<string, string | ((page: number, total: number) => string)>,
  pageIndex: number,
  totalPages: number,
  baseOptions: TextPaintOptions,
): Promise<void> {
  const headerText = header?.content ? stringify(header.content) : undefined;
  const footerText = footer?.content ? stringify(footer.content) : undefined;

  if (headerText) {
    const rendered = applyPlaceholders(headerText, tokens, pageIndex, totalPages);
    await painter.drawText(rendered, 16, header?.maxHeightPx ?? 24, { ...baseOptions, absolute: true });
  }

  if (footerText) {
    const rendered = applyPlaceholders(footerText, tokens, pageIndex, totalPages);
    const yPx = painter.pageHeightPx ? painter.pageHeightPx - ((footer?.maxHeightPx ?? 24) + 16) : 16;
    await painter.drawText(rendered, 16, yPx, { ...baseOptions, absolute: true });
  }
}

function stringify(content: unknown): string {
  if (content == null) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (typeof content === "function") {
    return String(content());
  }
  return JSON.stringify(content);
}

function buildRectClipPath(rect: { x: number; y: number; width: number; height: number }): PathCommand[] {
  const x = rect.x;
  const y = rect.y;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  return [
    { type: "moveTo", x, y },
    { type: "lineTo", x: right, y },
    { type: "lineTo", x: right, y: bottom },
    { type: "lineTo", x, y: bottom },
    { type: "closePath" },
  ];
}
