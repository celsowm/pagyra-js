import { log } from "../logging/debug.js";
import { renderHeaderFooterHtml } from "../pdf/header-footer-renderer.js";
import type { HeaderFooterHTML } from "../pdf/types.js";
import type { PageMarginsPx } from "../units/page-utils.js";
import type { Environment } from "../environment/environment.js";

const AUTO_HEADER_FOOTER_FALLBACK_PX = 64;

interface ResolveHeaderFooterMaxHeightsOptions {
  headerFooter?: Partial<HeaderFooterHTML>;
  pageWidthPx: number;
  pageHeightPx: number;
  margins: PageMarginsPx;
  resourceBaseDir: string;
  assetRootDir: string;
  environment: Environment;
}

interface MeasureHeaderFooterVariantsOptions {
  variants: string[];
  widthPx: number;
  maxHeightPx: number;
  resourceBaseDir: string;
  assetRootDir: string;
  environment: Environment;
}

export async function resolveHeaderFooterMaxHeights(
  options: ResolveHeaderFooterMaxHeightsOptions,
): Promise<Partial<HeaderFooterHTML> | undefined> {
  const { headerFooter } = options;
  if (!headerFooter) {
    return undefined;
  }

  const resolved: Partial<HeaderFooterHTML> = { ...headerFooter };
  const contentWidthPx = Math.max(1, options.pageWidthPx - options.margins.left - options.margins.right);
  const measurementMaxHeightPx = Math.max(1, options.pageHeightPx - options.margins.top - options.margins.bottom);

  if (!hasOwnProperty(headerFooter, "maxHeaderHeightPx")) {
    const headerCandidates = collectHeaderVariants(headerFooter);
    if (headerCandidates.length > 0) {
      const measured = await measureMaxHeaderFooterVariantHeight({
        variants: headerCandidates,
        widthPx: contentWidthPx,
        maxHeightPx: measurementMaxHeightPx,
        resourceBaseDir: options.resourceBaseDir,
        assetRootDir: options.assetRootDir,
        environment: options.environment,
      });
      resolved.maxHeaderHeightPx = measured > 0 ? measured : AUTO_HEADER_FOOTER_FALLBACK_PX;
    }
  }

  if (!hasOwnProperty(headerFooter, "maxFooterHeightPx")) {
    const footerCandidates = collectFooterVariants(headerFooter);
    if (footerCandidates.length > 0) {
      const measured = await measureMaxHeaderFooterVariantHeight({
        variants: footerCandidates,
        widthPx: contentWidthPx,
        maxHeightPx: measurementMaxHeightPx,
        resourceBaseDir: options.resourceBaseDir,
        assetRootDir: options.assetRootDir,
        environment: options.environment,
      });
      resolved.maxFooterHeightPx = measured > 0 ? measured : AUTO_HEADER_FOOTER_FALLBACK_PX;
    }
  }

  return resolved;
}

async function measureMaxHeaderFooterVariantHeight(options: MeasureHeaderFooterVariantsOptions): Promise<number> {
  const heights = await Promise.all(options.variants.map(async (html) => {
    try {
      const rendered = await renderHeaderFooterHtml({
        html,
        widthPx: options.widthPx,
        maxHeightPx: options.maxHeightPx,
        resourceBaseDir: options.resourceBaseDir,
        assetRootDir: options.assetRootDir,
        environment: options.environment,
      });
      return rendered ? Math.ceil(rendered.heightPx) : 0;
    } catch (error) {
      log("layout", "warn", "Failed to auto-measure header/footer variant height", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }));

  return Math.max(0, ...heights);
}

function collectHeaderVariants(headerFooter: Partial<HeaderFooterHTML>): string[] {
  const values = [
    headerFooter.headerHtml,
    headerFooter.headerFirstHtml,
    headerFooter.headerEvenHtml,
    headerFooter.headerOddHtml,
  ];
  return values.map(stringifyHeaderFooterContent).filter((value) => value.length > 0);
}

function collectFooterVariants(headerFooter: Partial<HeaderFooterHTML>): string[] {
  const values = [
    headerFooter.footerHtml,
    headerFooter.footerFirstHtml,
    headerFooter.footerEvenHtml,
    headerFooter.footerOddHtml,
  ];
  return values.map(stringifyHeaderFooterContent).filter((value) => value.length > 0);
}

function stringifyHeaderFooterContent(content: unknown): string {
  if (content == null) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (typeof content === "function") {
    try {
      return String(content());
    } catch {
      return "";
    }
  }
  return String(content);
}

function hasOwnProperty(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

