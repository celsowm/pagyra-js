// src/html-to-pdf.ts

import { parseHTML } from "linkedom";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type FontConfig } from "./types/fonts.js";
import { configureDebug, log, type LogLevel } from "./logging/debug.js";
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
import type { HeaderFooterHTML } from "./pdf/types.js";
import { FontEmbedder } from "./pdf/font/embedder.js";
import { PdfDocument } from "./pdf/primitives/pdf-document.js";
import { loadBuiltinFontConfig } from "./pdf/font/builtin-fonts.js";
import { Display } from "./css/enums.js";

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
  debugCats?: string[];
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
  const resolvedFontConfig = options.fontConfig ?? (await loadBuiltinFontConfig());
  const preparedOptions = resolvedFontConfig ? { ...options, fontConfig: resolvedFontConfig } : options;
  const prepared = await prepareHtmlRender(preparedOptions);
  return renderPdf(prepared.renderTree, { pageSize: prepared.pageSize, fontConfig: resolvedFontConfig ?? undefined });
}

export async function prepareHtmlRender(options: RenderHtmlOptions): Promise<PreparedRender> {
  const { html, css, viewportWidth, viewportHeight, pageWidth, pageHeight, margins, debug = false, debugLevel, debugCats, headerFooter } =
    options;
  const normalizedHtml = normalizeHtmlInput(html);

  setViewportSize(viewportWidth, viewportHeight);
  const resourceBaseDir = path.resolve(options.resourceBaseDir ?? options.assetRootDir ?? process.cwd());
  const assetRootDir = path.resolve(options.assetRootDir ?? resourceBaseDir);

  if (debugLevel || debugCats) {
    configureDebug({ level: debugLevel ?? (debug ? "debug" : "info"), cats: debugCats });
  }

  const unitCtx: UnitCtx = { viewport: { width: viewportWidth, height: viewportHeight } };
  const units = makeUnitParsers(unitCtx);

  log('html-to-pdf', 'debug', `prepareHtmlRender - input html: ${html}`);
  let { document } = parseHTML(normalizedHtml);
  if (needsReparse(document)) {
    document = parseHTML(wrapHtml(html)).document;
  }
  log('html-to-pdf', 'debug', `prepareHtmlRender - parsed document body: ${document.body?.innerHTML || 'no body'}`);
  log('html-to-pdf', 'debug', `prepareHtmlRender - document.documentElement tagName: ${document.documentElement?.tagName}`);
  log('html-to-pdf', 'debug', `prepareHtmlRender - document.documentElement innerHTML: ${document.documentElement?.innerHTML}`);
  log('html-to-pdf', 'debug', `prepareHtmlRender - document children count: ${document.childNodes.length}`);
  for (let i = 0; i < document.childNodes.length; i++) {
    const child = document.childNodes[i];
    log('html-to-pdf', 'debug', `prepareHtmlRender - document child ${i}: ${child.nodeType}, ${(child as any).tagName || 'text node'}`);
  }
  log("parse", "debug", "DOM parsed", { hasBody: !!document.body });

  let mergedCss = css || "";
  const styleTags = Array.from(document.querySelectorAll("style"));
  for (const styleTag of styleTags) {
    if (styleTag.textContent) mergedCss += "\n" + styleTag.textContent;
  }
  const linkTags = Array.from(document.querySelectorAll("link")).filter((link) => (link.getAttribute("rel") || "").toLowerCase() === "stylesheet");
  for (const linkTag of linkTags) {
    const href = linkTag.getAttribute("href");
    if (!href) continue;
    const cssText = await loadStylesheetFromHref(href, resourceBaseDir, assetRootDir);
    if (cssText) mergedCss += "\n" + cssText;
  }
  const { styleRules: cssRules, fontFaceRules } = parseCss(mergedCss);
  log("parse", "debug", "CSS rules", { count: cssRules.length, fontFaces: fontFaceRules.length });

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
  if (isInlineDisplay(rootStyle.display)) {
    rootStyle.display = Display.Block;
  }
  const rootLayout = new LayoutNode(rootStyle, [], { tagName: processChildrenOf?.tagName?.toLowerCase() });

  const conversionContext = { resourceBaseDir, assetRootDir, units, rootFontSize };
  
  if (processChildrenOf) {
    log('html-to-pdf', 'debug', `prepareHtmlRender - processing children of: ${processChildrenOf.tagName}, count: ${processChildrenOf.childNodes.length}`);
    for (const child of Array.from(processChildrenOf.childNodes)) {
      log('html-to-pdf', 'debug', `prepareHtmlRender - processing child: ${(child as any).tagName || 'text node'}, type: ${child.nodeType}`);
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

  const pdfDoc = new PdfDocument();

  // Process @font-face rules
  for (const fontFace of fontFaceRules) {
    const fontFamily = fontFace.declarations['font-family']?.replace(/['"]/g, '');
    const src = fontFace.declarations['src'];
    if (fontFamily && src) {
      const targetUrl = pickFontUrlFromSrc(src);
      if (targetUrl && options.fontConfig) {
        const fontData = await loadFontData(targetUrl, resourceBaseDir, assetRootDir);
        if (fontData) {
          const weightStr = fontFace.declarations["font-weight"] || "400";
          const styleStr = fontFace.declarations["font-style"] || "normal";
          options.fontConfig.fontFaceDefs.push({
            name: fontFamily,
            family: fontFamily,
            src: targetUrl,
            data: fontData,
            weight: parseFontWeight(weightStr),
            style: normalizeFontStyle(styleStr),
          });
        }
      }
    }
  }

  // In a browser environment, the font data should be pre-loaded and passed in the fontConfig.
  if (options.fontConfig) {
    for (const face of options.fontConfig.fontFaceDefs) {
      if (!face.data && face.src) {
        const loaded = await loadFontData(face.src, resourceBaseDir, assetRootDir);
        if (loaded) {
          (face as any).data = loaded;
        }
      }
    }
  }
  const fontEmbedder = options.fontConfig ? new FontEmbedder(options.fontConfig, pdfDoc) : null;
  if (fontEmbedder) {
    await fontEmbedder.initialize();
  }

  layoutTree(rootLayout, { width: viewportWidth, height: viewportHeight }, fontEmbedder);
  log("layout", "debug", "Layout complete");

  const renderTree = buildRenderTree(rootLayout, { headerFooter });
  applyPageVerticalMargins(renderTree.root, pageHeight, margins);
  offsetRenderTree(renderTree.root, margins.left, 0, debug);

  const pageSize = { widthPt: pxToPt(pageWidth), heightPt: pxToPt(pageHeight) };
  return { layoutRoot: rootLayout, renderTree, pageSize };
}

async function loadStylesheetFromHref(href: string, resourceBaseDir: string, assetRootDir: string): Promise<string> {
  const trimmed = href.trim();
  if (!trimmed) return "";

  try {
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//")) {
      const absoluteHref = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
      const response = await fetch(absoluteHref);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const cssText = await response.text();
      return rewriteCssUrls(cssText, absoluteHref);
    }

    let cssPath = trimmed;
    if (cssPath.startsWith("file://")) {
      cssPath = fileURLToPath(cssPath);
    } else if (cssPath.startsWith("/")) {
      cssPath = path.resolve(assetRootDir, `.${cssPath}`);
    } else if (!path.isAbsolute(cssPath)) {
      cssPath = path.resolve(resourceBaseDir, cssPath);
    }
    const cssText = readFileSync(cssPath, "utf-8");
    return rewriteCssUrls(cssText, pathToFileURL(cssPath).toString());
  } catch (error) {
  log("parse", "warn", "Failed to load stylesheet", { href, error: error instanceof Error ? error.message : String(error) });
    return "";
  }
}

function rewriteCssUrls(cssText: string, baseHref: string): string {
  let base: URL;
  try {
    base = new URL(baseHref);
  } catch {
    return cssText;
  }

  const urlRegex = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  return cssText.replace(urlRegex, (match, quote: string, rawUrl: string) => {
    const candidate = (rawUrl || "").trim();
    if (!candidate || /^data:/i.test(candidate)) return match;
    if (/^[a-z][a-z0-9+\-.]*:/i.test(candidate)) return match;
    try {
      const resolved = new URL(candidate, base).toString();
      const q = quote || "";
      return `url(${q}${resolved}${q})`;
    } catch {
      return match;
    }
  });
}

function pickFontUrlFromSrc(src: string): string | null {
  const urlRegex = /url\(\s*(['"]?)([^'")]+)\1\s*\)(?:\s*format\(\s*['"]?([^'")]+)['"]?\s*\))?/gi;
  let fallback: string | null = null;
  let preferred: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(src)) !== null) {
    const url = match[2];
    const format = (match[3] || "").toLowerCase();
    if (!fallback) fallback = url;
    if (format === "woff2") {
      preferred = url;
      break;
    }
  }

  return preferred ?? fallback;
}

function parseFontWeight(weightStr: string): number {
  const normalized = weightStr.trim().toLowerCase();
  if (normalized === "bold") return 700;
  if (normalized === "normal") return 400;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 400;
}

function normalizeFontStyle(styleStr: string): "normal" | "italic" {
  const normalized = styleStr.trim().toLowerCase();
  return normalized.includes("italic") || normalized.includes("oblique") ? "italic" : "normal";
}

async function loadFontData(src: string, resourceBaseDir: string, assetRootDir: string): Promise<ArrayBuffer | null> {
  const trimmed = src.trim();
  if (!trimmed) return null;
  let target = trimmed;

  try {
    if (target.startsWith("//")) {
      target = `https:${target}`;
    }

    if (/^data:/i.test(target)) {
      const commaIdx = target.indexOf(",");
      if (commaIdx === -1) {
        throw new Error("Invalid data URI");
      }
      const meta = target.slice(5, commaIdx);
      if (!/;base64/i.test(meta)) {
        throw new Error("Only base64-encoded data URIs are supported for fonts");
      }
      const data = Buffer.from(target.slice(commaIdx + 1), "base64");
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }

    if (/^https?:\/\//i.test(target)) {
      const response = await fetch(target);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.arrayBuffer();
    }

    if (target.startsWith("file://")) {
      target = fileURLToPath(target);
    } else if (target.startsWith("/")) {
      target = path.resolve(assetRootDir, `.${target}`);
    } else if (!path.isAbsolute(target)) {
      target = path.resolve(resourceBaseDir, target);
    }

    const fontDataBuffer = readFileSync(target);
    return fontDataBuffer.buffer.slice(
      fontDataBuffer.byteOffset,
      fontDataBuffer.byteOffset + fontDataBuffer.byteLength
    );
  } catch (error) {
  log("font", "warn", "Failed to load font data", { src, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
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

function normalizeHtmlInput(html: string): string {
  const hasHtmlTag = /<\s*html[\s>]/i.test(html);
  if (hasHtmlTag) {
    return html;
  }
  return wrapHtml(html);
}

function wrapHtml(html: string): string {
  return `<!doctype html><html><head></head><body>${html}</body></html>`;
}

function needsReparse(document: Document): boolean {
  const docEl = document.documentElement?.tagName;
  const docIsHtml = docEl?.toUpperCase() === "HTML";
  if (!docIsHtml) return true;
  if (!document.body) return true;
  return false;
}
