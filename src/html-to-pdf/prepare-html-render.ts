import { configureDebug, log } from "../logging/debug.js";
import { makeUnitParsers, type UnitCtx, pxToPt } from "../units/units.js";
import { layoutTree } from "../layout/pipeline/layout-tree.js";
import { applyForcedPageBreaks } from "../layout/fragmentation/forced-page-breaks.js";
import {
  PageFlowMetrics,
  type PageMarginProfile,
} from "../layout/fragmentation/page-flow.js";
import { buildRenderTree } from "../pdf/layout-tree-builder.js";
import { setViewportSize } from "../css/apply-declarations.js";
import {
  DEFAULT_PAGE_WIDTH_PX,
  DEFAULT_PAGE_HEIGHT_PX,
  resolvePageMarginsPx,
  sanitizeDimension,
  maxContentDimension,
  type PageMarginsPx,
} from "../units/page-utils.js";
import { NodeEnvironment } from "../environment/node-environment.js";
import { appendFontFacesFromCssRules, ensureFontFaceDataLoaded } from "./fonts.js";
import { resolveHeaderFooterMaxHeights } from "./header-footer.js";
import { normalizeHtmlInput } from "./html-parser.js";
import type { PreparedRender, RenderHtmlOptions } from "./types.js";
import { collectCssText, parseCssArtifacts, parseInputDocument } from "./document-css.js";
import {
  resolvePageStyleProfile,
  type ResolvedPageStyle,
  type ResolvedPageStyleProfile,
} from "../html/css/page-style.js";
import type { ParsedCss } from "../html/css/parse-css.js";
import { appendConvertedChildren, buildRootLayoutContext, createDomConversionContext } from "./layout-build.js";
import { finalizeRenderTreePositioning, initializeFontEmbedder } from "./render-finalize.js";

interface PageConfiguration {
  pageWidth: number;
  pageHeight: number;
  margins: PageMarginProfile;
  viewport: { width: number; height: number };
}

export async function prepareHtmlRender(options: RenderHtmlOptions): Promise<PreparedRender> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { html, css, pageWidth: _, pageHeight: __, margins: ___, ...restOptions } = options;
  const { html: htmlInput, css: cssInput = "" } = { html, css: css, ...restOptions };
  const {
    debug = false,
    debugLevel,
    debugCats,
    headerFooter,
    resourceBaseDir,
    assetRootDir,
    environment: envOverride,
    pagedBodyMargin = "auto",
    interBlockWhitespace = "collapse",
  } = options;
  const normalizedHtml = normalizeHtmlInput(htmlInput);

  if (debugLevel || debugCats) {
    configureDebug({ level: debugLevel ?? (debug ? "debug" : "info"), cats: debugCats });
  }

  const resourceBaseDirVal = resourceBaseDir ?? assetRootDir ?? "";
  const assetRootDirVal = assetRootDir ?? resourceBaseDirVal;
  const environment = envOverride ?? new NodeEnvironment(assetRootDirVal);
  const document = parseInputDocument(htmlInput, normalizedHtml);
  const mergedCss = await collectCssText({
    document,
    cssInput,
    resourceBaseDir: resourceBaseDirVal,
    assetRootDir: assetRootDirVal,
    environment,
  });

  const provisionalPageWidth = sanitizeDimension(options.pageWidth, DEFAULT_PAGE_WIDTH_PX);
  const provisionalPageHeight = sanitizeDimension(options.pageHeight, DEFAULT_PAGE_HEIGHT_PX);
  const provisionalMargins = mergePageMargins(
    resolvePageMarginsPx(provisionalPageWidth, provisionalPageHeight),
    options.margins,
    provisionalPageWidth,
    provisionalPageHeight,
  );
  const provisionalViewport = resolveViewport(options, provisionalPageWidth, provisionalPageHeight, {
    default: provisionalMargins,
    first: provisionalMargins,
    left: provisionalMargins,
    right: provisionalMargins,
  });

  let parsedCss = parseCssArtifacts(
    mergedCss,
    provisionalViewport.width,
    provisionalViewport.height,
  );
  let pageConfiguration = resolvePageConfiguration(parsedCss, options);

  // Page descriptors can change the print viewport, which can in turn change
  // matching @media rules. Iterate to a stable configuration with a hard cap.
  for (let attempt = 0; attempt < 3; attempt++) {
    const reparsedCss = parseCssArtifacts(
      mergedCss,
      pageConfiguration.viewport.width,
      pageConfiguration.viewport.height,
    );
    const nextConfiguration = resolvePageConfiguration(reparsedCss, options);
    parsedCss = reparsedCss;
    if (samePageConfiguration(pageConfiguration, nextConfiguration)) {
      pageConfiguration = nextConfiguration;
      break;
    }
    pageConfiguration = nextConfiguration;
  }

  const {
    pageWidth,
    pageHeight,
    margins: pageMargins,
    viewport,
  } = pageConfiguration;
  const marginsPx = pageMargins.default;
  const viewportWidth = viewport.width;
  const viewportHeight = viewport.height;
  setViewportSize(viewportWidth, viewportHeight);

  const resolvedHeaderFooter = await resolveHeaderFooterMaxHeights({
    headerFooter,
    pageWidthPx: pageWidth,
    pageHeightPx: pageHeight,
    margins: marginsPx,
    resourceBaseDir: resourceBaseDirVal,
    assetRootDir: assetRootDirVal,
    environment,
  });

  const unitCtx: UnitCtx = { viewport: { width: viewportWidth, height: viewportHeight } };
  const units = makeUnitParsers(unitCtx);
  const { styleRules: cssRules, fontFaceRules } = parsedCss;
  const { processChildrenOf, rootStyle, rootLayout, rootFontSize } = buildRootLayoutContext({
    document,
    cssRules,
    units,
    pagedBodyMargin,
  });

  const conversionContext = createDomConversionContext({
    resourceBaseDir: resourceBaseDirVal,
    assetRootDir: assetRootDirVal,
    units,
    rootFontSize,
    environment,
    interBlockWhitespace,
  });

  await appendConvertedChildren({
    processChildrenOf,
    rootLayout,
    cssRules,
    rootStyle,
    conversionContext,
  });

  await appendFontFacesFromCssRules(fontFaceRules, options.fontConfig, {
    resourceBaseDir: resourceBaseDirVal,
    assetRootDir: assetRootDirVal,
    environment,
  });
  await ensureFontFaceDataLoaded(options.fontConfig, {
    resourceBaseDir: resourceBaseDirVal,
    assetRootDir: assetRootDirVal,
    environment,
  });

  const fontEmbedder = await initializeFontEmbedder(options.fontConfig);

  layoutTree(rootLayout, { width: viewportWidth, height: viewportHeight }, fontEmbedder);
  const pageFlow = new PageFlowMetrics({
    pageHeight,
    margins: pageMargins,
    headerHeightPx: resolvedHeaderFooter?.maxHeaderHeightPx ?? 0,
    footerHeightPx: resolvedHeaderFooter?.maxFooterHeightPx ?? 0,
  });
  applyForcedPageBreaks(rootLayout, pageFlow);
  log("layout", "debug", "Layout complete");

  const renderTree = buildRenderTree(rootLayout, { headerFooter: resolvedHeaderFooter });
  finalizeRenderTreePositioning({
    renderTree,
    pageFlow,
    debug,
  });

  const pageSize = { widthPt: pxToPt(pageWidth), heightPt: pxToPt(pageHeight) };
  return { layoutRoot: rootLayout, renderTree, pageSize, margins: marginsPx };
}

function resolvePageConfiguration(
  parsedCss: ParsedCss,
  options: RenderHtmlOptions,
): PageConfiguration {
  const styles = resolvePageStyleProfile(parsedCss.pageRules, {
    width: DEFAULT_PAGE_WIDTH_PX,
    height: DEFAULT_PAGE_HEIGHT_PX,
  });

  // Public API dimensions and margins intentionally override every CSS @page variant.
  const pageWidth = sanitizeDimension(options.pageWidth, styles.default.width ?? DEFAULT_PAGE_WIDTH_PX);
  const pageHeight = sanitizeDimension(options.pageHeight, styles.default.height ?? DEFAULT_PAGE_HEIGHT_PX);
  const defaultMargins = resolvePageMarginsPx(pageWidth, pageHeight);
  const margins: PageMarginProfile = {
    default: resolveVariantMargins(defaultMargins, styles.default, options, pageWidth, pageHeight),
    first: resolveVariantMargins(defaultMargins, styles.first, options, pageWidth, pageHeight),
    left: resolveVariantMargins(defaultMargins, styles.left, options, pageWidth, pageHeight),
    right: resolveVariantMargins(defaultMargins, styles.right, options, pageWidth, pageHeight),
  };

  return {
    pageWidth,
    pageHeight,
    margins,
    viewport: resolveViewport(options, pageWidth, pageHeight, margins),
  };
}

function resolveVariantMargins(
  defaults: PageMarginsPx,
  style: ResolvedPageStyle,
  options: RenderHtmlOptions,
  pageWidth: number,
  pageHeight: number,
): PageMarginsPx {
  const cssMargins = mergePageMargins(defaults, style.margins, pageWidth, pageHeight);
  return mergePageMargins(cssMargins, options.margins, pageWidth, pageHeight);
}

function resolveViewport(
  options: RenderHtmlOptions,
  pageWidth: number,
  pageHeight: number,
  margins: PageMarginProfile,
): { width: number; height: number } {
  const variants = [
    margins.default,
    margins.first ?? margins.default,
    margins.left ?? margins.default,
    margins.right ?? margins.default,
  ];
  const maxContentWidth = Math.min(
    ...variants.map((variant) => maxContentDimension(pageWidth, variant.left + variant.right)),
  );
  const maxContentHeight = Math.min(
    ...variants.map((variant) => maxContentDimension(pageHeight, variant.top + variant.bottom)),
  );
  return {
    width: Math.min(sanitizeDimension(options.viewportWidth, maxContentWidth), maxContentWidth),
    height: Math.min(sanitizeDimension(options.viewportHeight, maxContentHeight), maxContentHeight),
  };
}

function samePageConfiguration(left: PageConfiguration, right: PageConfiguration): boolean {
  if (
    !close(left.pageWidth, right.pageWidth)
    || !close(left.pageHeight, right.pageHeight)
    || !close(left.viewport.width, right.viewport.width)
    || !close(left.viewport.height, right.viewport.height)
  ) {
    return false;
  }

  for (const variant of ["default", "first", "left", "right"] as const) {
    const leftMargins = left.margins[variant] ?? left.margins.default;
    const rightMargins = right.margins[variant] ?? right.margins.default;
    for (const side of ["top", "right", "bottom", "left"] as const) {
      if (!close(leftMargins[side], rightMargins[side])) {
        return false;
      }
    }
  }
  return true;
}

function close(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.01;
}

function mergePageMargins(
  defaults: PageMarginsPx,
  provided: Partial<PageMarginsPx> | undefined,
  pageWidth: number,
  pageHeight: number,
): PageMarginsPx {
  const margins: PageMarginsPx = { ...defaults };
  if (provided) {
    for (const side of ["top", "right", "bottom", "left"] as const) {
      const value = provided[side];
      if (Number.isFinite(value)) {
        margins[side] = Math.max(Number(value), 0);
      }
    }
  }

  const horizontalSum = margins.left + margins.right;
  const verticalSum = margins.top + margins.bottom;
  if (horizontalSum > pageWidth) {
    const scale = pageWidth / (horizontalSum || 1);
    margins.left *= scale;
    margins.right *= scale;
  }
  if (verticalSum > pageHeight) {
    const scale = pageHeight / (verticalSum || 1);
    margins.top *= scale;
    margins.bottom *= scale;
  }

  return margins;
}
