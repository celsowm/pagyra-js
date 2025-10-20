// src/html-to-pdf.ts

import { parseHTML } from "linkedom";
import path from "path";
import { type FontConfig } from "./types/fonts.js";
import { configureDebug, log, type LogCat, type LogLevel } from "./debug/log.js";
import { parseCss } from "./html/css/parse-css.js";
import { makeUnitParsers, type UnitCtx, pxToPt } from "./units/units.js";
import { LayoutNode } from "./dom/node.js";
import { ComputedStyle } from "./css/style.js";
import { layoutTree } from "./layout/pipeline/layout-tree.js";
import { buildRenderTree } from "./pdf/layout-tree-builder.js";
import { renderPdf } from "./pdf/render.js";
import { convertDomNode } from "./html/dom-converter.js";
import { offsetRenderTree } from "./render/offset.js";
import { setViewportSize } from "./css/apply-declarations.js";
import { type PageMarginsPx } from "./units/page-utils.js";
import { computeStyleForElement } from "./css/compute-style.js";
import type { RenderBox } from "./pdf/types.js";

export interface RenderHtmlOptions {
  html: string;
  css: string;
  viewportWidth: number;
  viewportHeight: number;
  pageWidth: number;
  pageHeight: number;
  margins: PageMarginsPx;
  debug?: boolean;
  debugLevel?: LogLevel;
  debugCats?: LogCat[];
  fontConfig?: FontConfig;
  resourceBaseDir?: string;
  assetRootDir?: string;
}

export interface PreparedRender {
  layoutRoot: LayoutNode;
  renderTree: ReturnType<typeof buildRenderTree>;
  pageSize: { widthPt: number; heightPt: number };
}

export async function renderHtmlToPdf(options: RenderHtmlOptions): Promise<Uint8Array> {
  const prepared = await prepareHtmlRender(options);
  return renderPdf(prepared.renderTree, { pageSize: prepared.pageSize, fontConfig: options.fontConfig });
}

export async function prepareHtmlRender(options: RenderHtmlOptions): Promise<PreparedRender> {
  const { html, css, viewportWidth, viewportHeight, pageWidth, pageHeight, margins, debug = false, debugLevel, debugCats } = options;

  setViewportSize(viewportWidth, viewportHeight);

  if (debugLevel || debugCats) {
    configureDebug(debugLevel ?? (debug ? "DEBUG" : "INFO"), debugCats ?? []);
  }

  const unitCtx: UnitCtx = { viewport: { width: viewportWidth, height: viewportHeight } };
  const units = makeUnitParsers(unitCtx);

  const { document } = parseHTML(html);
  log("PARSE", "DEBUG", "DOM parsed", { hasBody: !!document.body });

  let mergedCss = css || "";
  const styleTags = Array.from(document.querySelectorAll("style"));
  for (const styleTag of styleTags) {
    if (styleTag.textContent) mergedCss += "\n" + styleTag.textContent;
  }
  const cssRules = parseCss(mergedCss);
  log("PARSE", "DEBUG", "CSS rules", { count: cssRules.length });

  const bodyElement = (document.body ?? document.documentElement);
  const rootStyle = bodyElement ? computeStyleForElement(bodyElement, cssRules, new ComputedStyle(), units) : new ComputedStyle();
  const rootLayout = new LayoutNode(rootStyle, [], { tagName: bodyElement?.tagName?.toLowerCase() });

  const resourceBaseDir = path.resolve(options.resourceBaseDir ?? options.assetRootDir ?? process.cwd());
  const assetRootDir = path.resolve(options.assetRootDir ?? resourceBaseDir);
  
  if (bodyElement) {
      for (const child of Array.from(bodyElement.childNodes)) {
          const layoutChild = await convertDomNode(child, cssRules, rootStyle, { resourceBaseDir, assetRootDir, units });
          if (layoutChild) rootLayout.appendChild(layoutChild);
      }
  }

  layoutTree(rootLayout, { width: viewportWidth, height: viewportHeight });
  log("LAYOUT", "DEBUG", "Layout complete");

  const renderTree = buildRenderTree(rootLayout);
  offsetRenderTree(renderTree.root, margins.left, margins.top, debug);

  const pageSize = { widthPt: pxToPt(pageWidth), heightPt: pxToPt(pageHeight) };
  return { layoutRoot: rootLayout, renderTree, pageSize };
}
