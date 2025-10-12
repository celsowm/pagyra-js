import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import * as cssParser from "css";

import { LayoutNode } from "../src/dom/node.js";
import { ComputedStyle } from "../src/css/style.js";
import type { StyleProperties } from "../src/css/style.js";
import { Display, FloatMode } from "../src/css/enums.js";
import { layoutTree } from "../src/layout/pipeline/layout-tree.js";
import { buildRenderTree } from "../src/pdf/layout-tree-builder.js";
import { renderPdf } from "../src/pdf/render.js";

type CssDeclaration = cssParser.Declaration;
type CssRule = cssParser.Rule;
type DomElement = any;

interface CssRuleEntry {
  match: (element: DomElement) => boolean;
  declarations: Record<string, string>;
}

interface StyleAccumulator {
  display?: Display;
  float?: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderTop?: number;
  borderRight?: number;
  borderBottom?: number;
  borderLeft?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
}

interface RenderRequestBody {
  html?: string;
  css?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  pageWidth?: number;
  pageHeight?: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));

app.post("/render", async (req, res) => {
  try {
    const body = req.body as RenderRequestBody;
    if (!body || typeof body.html !== "string") {
      res.status(400).json({ error: "Request must include an 'html' field." });
      return;
    }

    const cssInput = typeof body.css === "string" ? body.css : "";
    const htmlInput = body.html;
    const viewportWidth = sanitizeDimension(body.viewportWidth, 800);
    const viewportHeight = sanitizeDimension(body.viewportHeight, 1120);
    const pageWidth = sanitizeDimension(body.pageWidth, viewportWidth);
    const pageHeight = sanitizeDimension(body.pageHeight, viewportHeight);

    const pdfBytes = renderHtmlToPdf({
      html: htmlInput,
      css: cssInput,
      viewportWidth,
      viewportHeight,
      pageWidth,
      pageHeight,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("[playground] render error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

const port = Number.parseInt(process.env.PORT ?? "", 10) || 5175;
app.listen(port, () => {
  console.log(`Pagyra HTML-to-PDF playground running at http://localhost:${port}`);
});

interface RenderHtmlOptions {
  html: string;
  css: string;
  viewportWidth: number;
  viewportHeight: number;
  pageWidth: number;
  pageHeight: number;
}

function renderHtmlToPdf(options: RenderHtmlOptions): Uint8Array {
  const { html, css, viewportWidth, viewportHeight, pageWidth, pageHeight } = options;
  const { document } = parseHTML(html);
  const cssRules = buildCssRules(css);

  const rootLayout = new LayoutNode(new ComputedStyle());
  const parentStyle = new ComputedStyle();
  const body = document.body ?? document.documentElement;

  for (const child of Array.from(body.childNodes)) {
    const layoutChild = convertDomNode(child, cssRules, parentStyle);
    if (layoutChild) {
      rootLayout.appendChild(layoutChild);
    }
  }

  layoutTree(rootLayout, { width: viewportWidth, height: viewportHeight });
  const renderTree = buildRenderTree(rootLayout);
  const pageSize = {
    widthPt: pxToPt(pageWidth),
    heightPt: pxToPt(pageHeight),
  };
  return renderPdf(renderTree, { pageSize });
}

function convertDomNode(node: Node, cssRules: CssRuleEntry[], parentStyle: ComputedStyle): LayoutNode | null {
  if (node.nodeType === node.TEXT_NODE) {
    const rawText = node.textContent ?? "";
    const collapsed = rawText.replace(/\s+/g, " ");
    const text = collapsed.trim();
    if (!text) {
      return null;
    }
    const textStyle = new ComputedStyle({
      display: Display.Inline,
      color: parentStyle.color,
      fontSize: parentStyle.fontSize,
      lineHeight: parentStyle.lineHeight,
      fontFamily: parentStyle.fontFamily,
    });
    return new LayoutNode(textStyle, [], { textContent: text });
  }

  if (node.nodeType !== node.ELEMENT_NODE) {
    return null;
  }

  const element = node as DomElement;
  const tagName = element.tagName.toLowerCase();
  if (tagName === "script" || tagName === "style") {
    return null;
  }

  if (tagName === "br") {
    const textStyle = new ComputedStyle({
      display: Display.Inline,
      color: parentStyle.color,
      fontSize: parentStyle.fontSize,
      lineHeight: parentStyle.lineHeight,
      fontFamily: parentStyle.fontFamily,
    });
    return new LayoutNode(textStyle, [], { textContent: "\n" });
  }

  const ownStyle = computeStyleForElement(element, cssRules, parentStyle);
  const layoutChildren: LayoutNode[] = [];
  for (const child of Array.from(element.childNodes)) {
    const childNode = convertDomNode(child, cssRules, ownStyle);
    if (childNode) {
      layoutChildren.push(childNode);
    }
  }

  return new LayoutNode(ownStyle, layoutChildren);
}

function computeStyleForElement(element: DomElement, cssRules: CssRuleEntry[], parentStyle: ComputedStyle): ComputedStyle {
  const inherited = {
    color: parentStyle.color,
    fontSize: parentStyle.fontSize,
    lineHeight: parentStyle.lineHeight,
    fontFamily: parentStyle.fontFamily,
  };

  const styleInit: StyleAccumulator = {};
  const aggregated: Partial<Record<string, string>> = {};

  for (const rule of cssRules) {
    if (rule.match(element)) {
      Object.assign(aggregated, rule.declarations);
    }
  }

  const inlineStyle = parseInlineStyle(element.getAttribute("style") ?? "");
  Object.assign(aggregated, inlineStyle);

  applyDeclarationsToStyle(aggregated, styleInit);

  const display = styleInit.display ?? defaultDisplayForTag(element.tagName.toLowerCase());
  const floatValue = mapFloat(styleInit.float);

  const styleOptions: Partial<StyleProperties> = {
    display,
    float: floatValue ?? FloatMode.None,
    color: inherited.color,
    fontSize: inherited.fontSize,
    lineHeight: inherited.lineHeight,
    fontFamily: inherited.fontFamily,
  };

  if (styleInit.color !== undefined) styleOptions.color = styleInit.color;
  if (styleInit.backgroundColor !== undefined) styleOptions.backgroundColor = styleInit.backgroundColor;
  if (styleInit.borderColor !== undefined) styleOptions.borderColor = styleInit.borderColor;
  if (styleInit.fontSize !== undefined) styleOptions.fontSize = styleInit.fontSize;
  if (styleInit.lineHeight !== undefined) styleOptions.lineHeight = styleInit.lineHeight;
  if (styleInit.fontFamily !== undefined) styleOptions.fontFamily = styleInit.fontFamily;
  if (styleInit.marginTop !== undefined) styleOptions.marginTop = styleInit.marginTop;
  if (styleInit.marginRight !== undefined) styleOptions.marginRight = styleInit.marginRight;
  if (styleInit.marginBottom !== undefined) styleOptions.marginBottom = styleInit.marginBottom;
  if (styleInit.marginLeft !== undefined) styleOptions.marginLeft = styleInit.marginLeft;
  if (styleInit.paddingTop !== undefined) styleOptions.paddingTop = styleInit.paddingTop;
  if (styleInit.paddingRight !== undefined) styleOptions.paddingRight = styleInit.paddingRight;
  if (styleInit.paddingBottom !== undefined) styleOptions.paddingBottom = styleInit.paddingBottom;
  if (styleInit.paddingLeft !== undefined) styleOptions.paddingLeft = styleInit.paddingLeft;
  if (styleInit.borderTop !== undefined) styleOptions.borderTop = styleInit.borderTop;
  if (styleInit.borderRight !== undefined) styleOptions.borderRight = styleInit.borderRight;
  if (styleInit.borderBottom !== undefined) styleOptions.borderBottom = styleInit.borderBottom;
  if (styleInit.borderLeft !== undefined) styleOptions.borderLeft = styleInit.borderLeft;
  if (styleInit.width !== undefined) styleOptions.width = styleInit.width;
  if (styleInit.height !== undefined) styleOptions.height = styleInit.height;

  return new ComputedStyle(styleOptions);
}

function defaultDisplayForTag(tag: string): Display {
  switch (tag) {
    case "span":
    case "a":
    case "strong":
    case "em":
    case "label":
    case "code":
    case "small":
      return Display.Inline;
    case "flex":
    case "div":
    case "section":
    case "main":
    case "article":
    case "header":
    case "footer":
    case "nav":
    case "p":
    case "ul":
    case "ol":
    case "li":
    case "table":
    case "tbody":
    case "thead":
    case "tr":
    case "td":
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return Display.Block;
    default:
      return Display.Block;
  }
}

function mapFloat(value: string | undefined): FloatMode | undefined {
  switch (value) {
    case "left":
      return FloatMode.Left;
    case "right":
      return FloatMode.Right;
    default:
      return undefined;
  }
}

function applyDeclarationsToStyle(declarations: Record<string, string>, target: StyleAccumulator): void {
  for (const [property, value] of Object.entries(declarations)) {
    switch (property) {
      case "display":
        target.display = mapDisplay(value);
        break;
      case "color":
        target.color = value;
        break;
      case "background-color":
        target.backgroundColor = value;
        break;
      case "border-color":
        target.borderColor = value;
        break;
      case "border":
        const borderWidth = parseNumeric(value);
        if (borderWidth !== undefined) {
          target.borderTop = borderWidth;
          target.borderRight = borderWidth;
          target.borderBottom = borderWidth;
          target.borderLeft = borderWidth;
        }
        break;
      case "border-width":
        applyBoxShorthand(value, (top, right, bottom, left) => {
          target.borderTop = top;
          target.borderRight = right;
          target.borderBottom = bottom;
          target.borderLeft = left;
        });
        break;
      case "border-top-width":
        target.borderTop = parseNumeric(value) ?? target.borderTop;
        break;
      case "border-right-width":
        target.borderRight = parseNumeric(value) ?? target.borderRight;
        break;
      case "border-bottom-width":
        target.borderBottom = parseNumeric(value) ?? target.borderBottom;
        break;
      case "border-left-width":
        target.borderLeft = parseNumeric(value) ?? target.borderLeft;
        break;
      case "margin":
        applyBoxShorthand(value, (top, right, bottom, left) => {
          target.marginTop = top;
          target.marginRight = right;
          target.marginBottom = bottom;
          target.marginLeft = left;
        });
        break;
      case "margin-top":
        target.marginTop = parseLength(value) ?? target.marginTop;
        break;
      case "margin-right":
        target.marginRight = parseLength(value) ?? target.marginRight;
        break;
      case "margin-bottom":
        target.marginBottom = parseLength(value) ?? target.marginBottom;
        break;
      case "margin-left":
        target.marginLeft = parseLength(value) ?? target.marginLeft;
        break;
      case "padding":
        applyBoxShorthand(value, (top, right, bottom, left) => {
          target.paddingTop = top;
          target.paddingRight = right;
          target.paddingBottom = bottom;
          target.paddingLeft = left;
        });
        break;
      case "padding-top":
        target.paddingTop = parseLength(value) ?? target.paddingTop;
        break;
      case "padding-right":
        target.paddingRight = parseLength(value) ?? target.paddingRight;
        break;
      case "padding-bottom":
        target.paddingBottom = parseLength(value) ?? target.paddingBottom;
        break;
      case "padding-left":
        target.paddingLeft = parseLength(value) ?? target.paddingLeft;
        break;
      case "width":
        target.width = parseLength(value) ?? target.width;
        break;
      case "height":
        target.height = parseLength(value) ?? target.height;
        break;
      case "font-size":
        target.fontSize = parseNumeric(value) ?? target.fontSize;
        break;
      case "line-height":
        target.lineHeight = parseLineHeight(value);
        break;
      case "font-family":
        target.fontFamily = value;
        break;
      case "float":
        target.float = value;
        break;
      default:
        break;
    }
  }
}

function applyBoxShorthand(
  value: string,
  apply: (top: number | undefined, right: number | undefined, bottom: number | undefined, left: number | undefined) => void,
): void {
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return;
  }
  const resolved = parts.map(parseLength);
  const [top, right, bottom, left] =
    resolved.length === 1
      ? [resolved[0], resolved[0], resolved[0], resolved[0]]
      : resolved.length === 2
        ? [resolved[0], resolved[1], resolved[0], resolved[1]]
        : resolved.length === 3
          ? [resolved[0], resolved[1], resolved[2], resolved[1]]
          : [resolved[0], resolved[1], resolved[2], resolved[3]];
  apply(top, right, bottom, left);
}

function parseLength(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "auto") {
    return undefined;
  }
  const numeric = parseNumeric(value);
  return numeric;
}

function parseNumeric(value: string): number | undefined {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px)?$/i);
  if (!match) {
    return undefined;
  }
  return Number.parseFloat(match[1]);
}

function parseLineHeight(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  if (value.endsWith("px")) {
    return Number.parseFloat(value);
  }
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return undefined;
  }
  return numeric;
}

function mapDisplay(value: string | undefined): Display | undefined {
  switch (value) {
    case "block":
      return Display.Block;
    case "inline":
      return Display.Inline;
    case "inline-block":
      return Display.InlineBlock;
    case "flex":
      return Display.Flex;
    case "grid":
      return Display.Grid;
    case "none":
      return Display.None;
    default:
      return undefined;
  }
}

function parseInlineStyle(style: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  for (const part of style.split(";")) {
    const [rawProperty, rawValue] = part.split(":");
    if (!rawProperty || !rawValue) {
      continue;
    }
    const property = rawProperty.trim().toLowerCase();
    const value = rawValue.trim();
    if (property) {
      declarations[property] = value;
    }
  }
  return declarations;
}

function buildCssRules(cssText: string): CssRuleEntry[] {
  if (!cssText.trim()) {
    return [];
  }
  const stylesheet = cssParser.parse(cssText);
  const result: CssRuleEntry[] = [];
  const rules = stylesheet.stylesheet?.rules ?? [];
  for (const rule of rules) {
    if (rule.type !== "rule") {
      continue;
    }
    const typedRule = rule as CssRule;
    const selectors = typedRule.selectors ?? [];
    const decls = typedRule.declarations ?? [];
    const declarations: Record<string, string> = {};
    for (const decl of decls) {
      if (!decl || decl.type !== "declaration") {
        continue;
      }
      const declaration = decl as CssDeclaration;
      if (!declaration.property || declaration.value === undefined) {
        continue;
      }
      declarations[declaration.property.trim().toLowerCase()] = declaration.value.trim();
    }
    for (const selector of selectors) {
      const matcher = createSelectorMatcher(selector.trim());
      if (!matcher) {
        continue;
      }
      result.push({ match: matcher, declarations: { ...declarations } });
    }
  }
  return result;
}

function createSelectorMatcher(selector: string): ((element: DomElement) => boolean) | null {
  if (!selector || selector.includes(" ")) {
    return null;
  }

  let working = selector;
  let id: string | null = null;
  const classes: string[] = [];

  const idMatch = working.match(/#[^.#]+/g);
  if (idMatch) {
    id = idMatch[0].slice(1);
    working = working.replace(idMatch[0], "");
  }

  const classMatches = working.match(/\.[^.#]+/g) ?? [];
  for (const cls of classMatches) {
    classes.push(cls.slice(1));
    working = working.replace(cls, "");
  }

  const tag = working.length > 0 ? working.toLowerCase() : null;

  return (element: DomElement) => {
    if (tag && element.tagName.toLowerCase() !== tag) {
      return false;
    }
    if (id && element.id !== id) {
      return false;
    }
    for (const cls of classes) {
      if (!element.classList.contains(cls)) {
        return false;
      }
    }
    return true;
  };
}

function sanitizeDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value ?? NaN)) {
    return fallback;
  }
  const sanitized = Number(value);
  return sanitized > 0 ? sanitized : fallback;
}

function pxToPt(px: number): number {
  return (px / 96) * 72;
}
