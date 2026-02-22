import { log } from "../logging/debug.js";
import { parseCss } from "../html/css/parse-css.js";
import type { Environment } from "../environment/environment.js";
import { loadStylesheetFromHref } from "./resource-loader.js";
import { needsReparse, parseDocument, wrapHtml } from "./html-parser.js";

export function parseInputDocument(htmlInput: string, normalizedHtml: string): Document {
  log("html-to-pdf", "debug", `prepareHtmlRender - input html: ${htmlInput}`);
  let document = parseDocument(normalizedHtml);
  if (needsReparse(document)) {
    document = parseDocument(wrapHtml(htmlInput));
  }
  if (!document) {
    throw new Error("Failed to parse HTML into a document");
  }

  log("html-to-pdf", "debug", `prepareHtmlRender - parsed document body: ${document.body?.innerHTML || "no body"}`);
  log("html-to-pdf", "debug", `prepareHtmlRender - document.documentElement tagName: ${document.documentElement?.tagName}`);
  log("html-to-pdf", "debug", `prepareHtmlRender - document.documentElement innerHTML: ${document.documentElement?.innerHTML}`);
  log("html-to-pdf", "debug", `prepareHtmlRender - document children count: ${document.childNodes.length}`);
  for (let i = 0; i < document.childNodes.length; i++) {
    const child = document.childNodes[i];
    const tagName = child.nodeType === child.ELEMENT_NODE ? (child as Element).tagName : "text node";
    log("html-to-pdf", "debug", `prepareHtmlRender - document child ${i}: ${child.nodeType}, ${tagName}`);
  }
  log("parse", "debug", "DOM parsed", { hasBody: !!document.body });

  return document;
}

interface CollectCssArtifactsOptions {
  document: Document;
  cssInput: string;
  resourceBaseDir: string;
  assetRootDir: string;
  environment: Environment;
}

export async function collectCssArtifacts(options: CollectCssArtifactsOptions) {
  let mergedCss = options.cssInput || "";

  const styleTags = Array.from(options.document.querySelectorAll("style"));
  for (const styleTag of styleTags) {
    if (styleTag.textContent) mergedCss += `\n${styleTag.textContent}`;
  }

  const linkTags = Array.from(options.document.querySelectorAll("link")).filter(
    (link) => (link.getAttribute("rel") || "").toLowerCase() === "stylesheet",
  );
  for (const linkTag of linkTags) {
    const href = linkTag.getAttribute("href");
    if (!href) continue;
    const cssText = await loadStylesheetFromHref(href, options.resourceBaseDir, options.assetRootDir, options.environment);
    if (cssText) mergedCss += `\n${cssText}`;
  }

  const { styleRules: cssRules, fontFaceRules } = parseCss(mergedCss);
  log("parse", "debug", "CSS rules", { count: cssRules.length, fontFaces: fontFaceRules.length });
  return { cssRules, fontFaceRules };
}

