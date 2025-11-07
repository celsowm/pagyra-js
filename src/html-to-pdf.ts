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
import { applyPageVerticalMargins, offsetRenderTree } from "./render/offset.js";
import { setViewportSize } from "./css/apply-declarations.js";
import { type PageMarginsPx } from "./units/page-utils.js";
import { computeStyleForElement } from "./css/compute-style.js";
import type { RenderBox } from "./pdf/types.js";
import type { HeaderFooterHTML } from "./pdf/types.js";

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
  headerFooter?: Partial<HeaderFooterHTML>;
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
  const { html, css, viewportWidth, viewportHeight, pageWidth, pageHeight, margins, debug = false, debugLevel, debugCats, headerFooter } =
    options;

  setViewportSize(viewportWidth, viewportHeight);

  if (debugLevel || debugCats) {
    configureDebug(debugLevel ?? (debug ? "DEBUG" : "INFO"), debugCats ?? []);
  }

  const unitCtx: UnitCtx = { viewport: { width: viewportWidth, height: viewportHeight } };
  const units = makeUnitParsers(unitCtx);

  console.log("prepareHtmlRender - input html:", html);
  const { document } = parseHTML(html);
  console.log("prepareHtmlRender - parsed document body:", document.body?.innerHTML || 'no body');
  console.log("prepareHtmlRender - document.documentElement tagName:", document.documentElement?.tagName);
  console.log("prepareHtmlRender - document.documentElement innerHTML:", document.documentElement?.innerHTML);
  console.log("prepareHtmlRender - document children count:", document.childNodes.length);
  for (let i = 0; i < document.childNodes.length; i++) {
    const child = document.childNodes[i];
    console.log(`prepareHtmlRender - document child ${i}:`, child.nodeType, (child as any).tagName || 'text node');
  }
  log("PARSE", "DEBUG", "DOM parsed", { hasBody: !!document.body });

  let mergedCss = css || "";
  const styleTags = Array.from(document.querySelectorAll("style"));
  for (const styleTag of styleTags) {
    if (styleTag.textContent) mergedCss += "\n" + styleTag.textContent;
  }
  const cssRules = parseCss(mergedCss);
  log("PARSE", "DEBUG", "CSS rules", { count: cssRules.length });

  // Determine the root element to process - prefer body, but fall back to documentElement if body is empty
  let rootElement = document.body;
  let processChildrenOf = rootElement;
  
  // If body is empty but documentElement has children (like when HTML is just a fragment),
  // process the documentElement's children instead
  if (rootElement && rootElement.childNodes.length === 0) {
    // Check if documentElement has meaningful children
    const meaningfulChildren = Array.from(document.documentElement.childNodes).filter(node => {
      return node.nodeType === node.ELEMENT_NODE && (node as HTMLElement).tagName !== 'HEAD';
    });
    if (meaningfulChildren.length > 0) {
      processChildrenOf = document.documentElement;
    }
  } else if (!rootElement) {
    // If there's no body element, process documentElement children directly
    processChildrenOf = document.documentElement;
  }

  const baseParentStyle = new ComputedStyle();
  const htmlElement = document.documentElement;
  const documentElementStyle = htmlElement
    ? computeStyleForElement(htmlElement, cssRules, baseParentStyle, units, baseParentStyle.fontSize)
    : baseParentStyle;
  const rootFontSize = documentElementStyle.fontSize;

  let rootStyle: ComputedStyle;
  if (!processChildrenOf || processChildrenOf === htmlElement) {
    rootStyle = documentElementStyle;
  } else {
    rootStyle = computeStyleForElement(processChildrenOf, cssRules, documentElementStyle, units, rootFontSize);
  }
  const rootLayout = new LayoutNode(rootStyle, [], { tagName: processChildrenOf?.tagName?.toLowerCase() });

  const resourceBaseDir = path.resolve(options.resourceBaseDir ?? options.assetRootDir ?? process.cwd());
  const assetRootDir = path.resolve(options.assetRootDir ?? resourceBaseDir);
  const conversionContext = { resourceBaseDir, assetRootDir, units, rootFontSize };
  
  if (processChildrenOf) {
    console.log("prepareHtmlRender - processing children of:", processChildrenOf.tagName, "count:", processChildrenOf.childNodes.length);
    for (const child of Array.from(processChildrenOf.childNodes)) {
      console.log("prepareHtmlRender - processing child:", (child as any).tagName || 'text node', "type:", child.nodeType);
      // Skip head and other non-content elements
      if (child.nodeType === child.ELEMENT_NODE) {
        const tagName = (child as HTMLElement).tagName.toLowerCase();
        if (tagName === 'head' || tagName === 'meta' || tagName === 'title' || tagName === 'link' || tagName === 'script') {
          continue;
        }
      }
      const layoutChild = await convertDomNode(child, cssRules, rootStyle, conversionContext);
      if (layoutChild) rootLayout.appendChild(layoutChild);
    }
  }

  layoutTree(rootLayout, { width: viewportWidth, height: viewportHeight });
  log("LAYOUT", "DEBUG", "Layout complete");

  const renderTree = buildRenderTree(rootLayout, { headerFooter });
  applyPageVerticalMargins(renderTree.root, pageHeight, margins);
  offsetRenderTree(renderTree.root, margins.left, 0, debug);

  const pageSize = { widthPt: pxToPt(pageWidth), heightPt: pxToPt(pageHeight) };
  return { layoutRoot: rootLayout, renderTree, pageSize };
}
