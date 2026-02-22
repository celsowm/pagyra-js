import { configureDebug, log } from "../logging/debug.js";
import { makeUnitParsers, type UnitCtx, pxToPt } from "../units/units.js";
import { layoutTree } from "../layout/pipeline/layout-tree.js";
import { buildRenderTree } from "../pdf/layout-tree-builder.js";
import { setViewportSize } from "../css/apply-declarations.js";
import {
  DEFAULT_PAGE_WIDTH_PX,
  DEFAULT_PAGE_HEIGHT_PX,
  resolvePageMarginsPx,
  sanitizeDimension,
  maxContentDimension,
} from "../units/page-utils.js";
import { NodeEnvironment } from "../environment/node-environment.js";
import { appendFontFacesFromCssRules, ensureFontFaceDataLoaded } from "./fonts.js";
import { resolveHeaderFooterMaxHeights } from "./header-footer.js";
import { normalizeHtmlInput } from "./html-parser.js";
import type { PreparedRender, RenderHtmlOptions } from "./types.js";
import { collectCssArtifacts, parseInputDocument } from "./document-css.js";
import { appendConvertedChildren, buildRootLayoutContext, createDomConversionContext } from "./layout-build.js";
import { finalizeRenderTreePositioning, initializeFontEmbedder } from "./render-finalize.js";

export async function prepareHtmlRender(options: RenderHtmlOptions): Promise<PreparedRender> {
  const pageWidth = sanitizeDimension(options.pageWidth, DEFAULT_PAGE_WIDTH_PX);
  const pageHeight = sanitizeDimension(options.pageHeight, DEFAULT_PAGE_HEIGHT_PX);
  const marginsPx = resolvePageMarginsPx(pageWidth, pageHeight);
  const maxContentWidth = maxContentDimension(pageWidth, marginsPx.left + marginsPx.right);
  const maxContentHeight = maxContentDimension(pageHeight, marginsPx.top + marginsPx.bottom);
  const viewportWidth = Math.min(sanitizeDimension(options.viewportWidth, maxContentWidth), maxContentWidth);
  const viewportHeight = Math.min(sanitizeDimension(options.viewportHeight, maxContentHeight), maxContentHeight);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { html, css, pageWidth: _, pageHeight: __, margins: ___, ...restOptions } = options;
  const { html: htmlInput, css: cssInput = "" } = { html, css: css, ...restOptions };
  const { debug = false, debugLevel, debugCats, headerFooter, resourceBaseDir, assetRootDir, environment: envOverride } = options;
  const normalizedHtml = normalizeHtmlInput(htmlInput);

  setViewportSize(viewportWidth, viewportHeight);
  const resourceBaseDirVal = resourceBaseDir ?? assetRootDir ?? "";
  const assetRootDirVal = assetRootDir ?? resourceBaseDirVal;
  const environment = envOverride ?? new NodeEnvironment(assetRootDirVal);
  const resolvedHeaderFooter = await resolveHeaderFooterMaxHeights({
    headerFooter,
    pageWidthPx: pageWidth,
    pageHeightPx: pageHeight,
    margins: marginsPx,
    resourceBaseDir: resourceBaseDirVal,
    assetRootDir: assetRootDirVal,
    environment,
  });

  if (debugLevel || debugCats) {
    configureDebug({ level: debugLevel ?? (debug ? "debug" : "info"), cats: debugCats });
  }

  const unitCtx: UnitCtx = { viewport: { width: viewportWidth, height: viewportHeight } };
  const units = makeUnitParsers(unitCtx);

  const document = parseInputDocument(htmlInput, normalizedHtml);
  const { cssRules, fontFaceRules } = await collectCssArtifacts({
    document,
    cssInput,
    resourceBaseDir: resourceBaseDirVal,
    assetRootDir: assetRootDirVal,
    environment,
  });
  const { processChildrenOf, rootStyle, rootLayout, rootFontSize } = buildRootLayoutContext({
    document,
    cssRules,
    units,
  });

  const conversionContext = createDomConversionContext({
    resourceBaseDir: resourceBaseDirVal,
    assetRootDir: assetRootDirVal,
    units,
    rootFontSize,
    environment,
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
  log("layout", "debug", "Layout complete");

  const renderTree = buildRenderTree(rootLayout, { headerFooter: resolvedHeaderFooter });
  finalizeRenderTreePositioning({
    renderTree,
    resolvedHeaderFooter,
    pageHeight,
    marginsPx,
    debug,
  });

  const pageSize = { widthPt: pxToPt(pageWidth), heightPt: pxToPt(pageHeight) };
  return { layoutRoot: rootLayout, renderTree, pageSize, margins: marginsPx };
}
