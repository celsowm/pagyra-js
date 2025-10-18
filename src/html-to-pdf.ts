import { parseHTML } from "linkedom";
import * as cssParser from "css";

import { LayoutNode } from "./dom/node.js";
import { ComputedStyle } from "./css/style.js";
import type { StyleProperties } from "./css/style.js";
import { BorderModel, Display, FloatMode } from "./css/enums.js";
import { BrowserDefaults, ElementSpecificDefaults } from "./css/browser-defaults.js";
import { parseFontWeightValue, normalizeFontWeight } from "./css/font-weight.js";
import { layoutTree } from "./layout/pipeline/layout-tree.js";
import { buildRenderTree } from "./pdf/layout-tree-builder.js";
import { renderPdf } from "./pdf/render.js";
import type { RenderBox, Rect } from "./pdf/types.js";

type CssDeclaration = cssParser.Declaration;
type CssRule = cssParser.Rule;
type DomElement = any;

import { configureDebug, log, type LogCat, type LogLevel } from "./debug/log.js";

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
  fontWeight?: number;
  borderModel?: BorderModel;
}

import type { FontConfig } from "./types/fonts.js";

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
}

export interface PageMarginsPx {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_PAGE_SIZE_PT = { width: 595.28, height: 841.89 };
export const DEFAULT_PAGE_MARGINS_PT = { top: 36, right: 36, bottom: 36, left: 36 };
export const DEFAULT_PAGE_WIDTH_PX = ptToPx(DEFAULT_PAGE_SIZE_PT.width);
export const DEFAULT_PAGE_HEIGHT_PX = ptToPx(DEFAULT_PAGE_SIZE_PT.height);
export const DEFAULT_PAGE_MARGINS_PX = {
  top: ptToPx(DEFAULT_PAGE_MARGINS_PT.top),
  right: ptToPx(DEFAULT_PAGE_MARGINS_PT.right),
  bottom: ptToPx(DEFAULT_PAGE_MARGINS_PT.bottom),
  left: ptToPx(DEFAULT_PAGE_MARGINS_PT.left),
};

export async function renderHtmlToPdf(options: RenderHtmlOptions): Promise<Uint8Array> {
  const prepared = prepareHtmlRender(options);
  return renderPdf(prepared.renderTree, { pageSize: prepared.pageSize, fontConfig: options.fontConfig });
}

export interface PreparedRender {
  layoutRoot: LayoutNode;
  renderTree: ReturnType<typeof buildRenderTree>;
  pageSize: { widthPt: number; heightPt: number };
}

export function prepareHtmlRender(options: RenderHtmlOptions): PreparedRender {
  const { html, css, viewportWidth, viewportHeight, pageWidth, pageHeight, margins, debug = false, debugLevel, debugCats } = options;

  // Configure debugging backward compatibility: debug=true => DEBUG level with RENDER_TREE category
  if (debugLevel || debugCats) {
    configureDebug(debugLevel ?? (debug ? "DEBUG" : "INFO"), debugCats ?? (debug ? ["RENDER_TREE"] : []));
  } else if (debug) {
    configureDebug("DEBUG", ["RENDER_TREE"]);
  }

  const { document } = parseHTML(html);
  log("PARSE","DEBUG","DOM parsed", {
    hasBody: !!document.body,
    childNodes: document.body?.childNodes?.length ?? 0
  });

  // Extract CSS from <style> tags in the HTML
  let mergedCss = css || "";
  const styleTags = document.querySelectorAll ? document.querySelectorAll("style") : [];
  if (styleTags && styleTags.length > 0) {
    for (const styleTag of Array.from(styleTags)) {
      if (styleTag.textContent) {
        mergedCss += "\n" + styleTag.textContent;
      }
    }
  }
  const cssRules = buildCssRules(mergedCss);
  log("PARSE","DEBUG","CSS rules", { count: cssRules.length });

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
  log("LAYOUT","DEBUG","layout complete", {
    rootWidth: rootLayout.box.contentWidth,
    rootHeight: rootLayout.box.contentHeight,
    children: rootLayout.children.length
  });
  const renderTree = buildRenderTree(rootLayout);
  offsetRenderTree(renderTree.root, margins.left, margins.top, debug);
  const pageSize = {
    widthPt: pxToPt(pageWidth),
    heightPt: pxToPt(pageHeight),
  };
  return { layoutRoot: rootLayout, renderTree, pageSize };
}

function offsetRenderTree(root: RenderBox, dx: number, dy: number, debug: boolean): void {
  const stack: RenderBox[] = [root];
  while (stack.length > 0) {
    const box = stack.pop()!;
    log("RENDER_TREE","TRACE",'offset render tree box', {
      tagName: box.tagName,
      textContent: box.textContent,
      x: box.contentBox.x,
      y: box.contentBox.y,
      width: box.contentBox.width,
      height: box.contentBox.height,
    });
    offsetRect(box.contentBox, dx, dy);
    offsetRect(box.paddingBox, dx, dy);
    offsetRect(box.borderBox, dx, dy);
    offsetRect(box.visualOverflow, dx, dy);
    if (box.markerRect) {
      offsetRect(box.markerRect, dx, dy);
    }
    for (const link of box.links) {
      offsetRect(link.rect, dx, dy);
    }
    for (const run of box.textRuns) {
      if (run.lineMatrix) {
        run.lineMatrix.e += dx;
        run.lineMatrix.f += dy;
      }
    }
    for (const child of box.children) {
      stack.push(child);
    }
  }
}

function offsetRect(rect: Rect | null | undefined, dx: number, dy: number): void {
  if (!rect) {
    return;
  }
  rect.x += dx;
  rect.y += dy;
}

function convertDomNode(node: Node, cssRules: CssRuleEntry[], parentStyle: ComputedStyle): LayoutNode | null {
  if (node.nodeType === node.TEXT_NODE) {
    const raw = node.textContent ?? "";
    const collapsed = raw.replace(/\s+/g, " ");
    const text = collapsed.normalize("NFC").trim();
    if (!text) return null;
    const textStyle = new ComputedStyle({
      display: Display.Inline,
      color: parentStyle.color,
      fontSize: parentStyle.fontSize,
      lineHeight: parentStyle.lineHeight,
      fontFamily: parentStyle.fontFamily,
      fontWeight: parentStyle.fontWeight,
    });
    return new LayoutNode(textStyle, [], { textContent: text });
  }

  if (node.nodeType !== node.ELEMENT_NODE) return null;

  const element = node as DomElement;
  const tagName = element.tagName.toLowerCase();
  if (tagName === "script" || tagName === "style") return null;

  if (tagName === "br") {
    const textStyle = new ComputedStyle({
      display: Display.Inline,
      color: parentStyle.color,
      fontSize: parentStyle.fontSize,
      lineHeight: parentStyle.lineHeight,
      fontFamily: parentStyle.fontFamily,
      fontWeight: parentStyle.fontWeight,
    });
    return new LayoutNode(textStyle, [], { textContent: "\n" });
  }

  // ✅ Coalescing de #text
  const ownStyle = computeStyleForElement(element, cssRules, parentStyle);
  const layoutChildren: LayoutNode[] = [];
  let textBuf = "";

  for (const child of Array.from(element.childNodes) as Node[]) {
    if (child.nodeType === child.TEXT_NODE) {
      textBuf += child.textContent ?? "";
      continue;
    }
    if (textBuf) {
      const normalized = textBuf.replace(/\s+/g, " ").normalize("NFC").trim();
      if (normalized) {
        layoutChildren.push(new LayoutNode(new ComputedStyle({
          display: Display.Inline,
          color: ownStyle.color,
          fontSize: ownStyle.fontSize,
          lineHeight: ownStyle.lineHeight,
          fontFamily: ownStyle.fontFamily,
          fontWeight: ownStyle.fontWeight,
        }), [], { textContent: normalized }));
      }
      textBuf = "";
    }
    const sub = convertDomNode(child, cssRules, ownStyle);
    if (sub) layoutChildren.push(sub);
  }
  if (textBuf) {
    const normalized = textBuf.replace(/\s+/g, " ").normalize("NFC").trim();
    if (normalized) {
      layoutChildren.push(new LayoutNode(new ComputedStyle({
        display: Display.Inline,
        color: ownStyle.color,
        fontSize: ownStyle.fontSize,
        lineHeight: ownStyle.lineHeight,
        fontFamily: ownStyle.fontFamily,
        fontWeight: ownStyle.fontWeight,
      }), [], { textContent: normalized }));
    }
  }

  return new LayoutNode(ownStyle, layoutChildren, { tagName });
}

function computeStyleForElement(element: DomElement, cssRules: CssRuleEntry[], parentStyle: ComputedStyle): ComputedStyle {
  const tagName = element.tagName.toLowerCase();

  // Get element-specific defaults from browser defaults system
  const elementDefaults = ElementSpecificDefaults.getDefaultsForElement(tagName);

  // Create base style with browser defaults
  const baseDefaults = BrowserDefaults.createBaseDefaults();

  // Merge element-specific defaults with base defaults
  const mergedDefaults = BrowserDefaults.mergeElementDefaults(baseDefaults, elementDefaults);

  // Apply inheritance from parent
  const inherited = {
    color: parentStyle.color ?? mergedDefaults.color,
    fontSize: parentStyle.fontSize,
    lineHeight: parentStyle.lineHeight,
    fontFamily: parentStyle.fontFamily ?? mergedDefaults.fontFamily,
    fontWeight: parentStyle.fontWeight ?? mergedDefaults.fontWeight,
  };

  const styleInit: StyleAccumulator = {};
  const aggregated: Record<string, string> = {};

  // Apply CSS rules
  for (const rule of cssRules) {
    if (rule.match(element)) {
      log("STYLE","DEBUG","CSS rule matched", { selector: (rule as any).selector, declarations: rule.declarations });
      if (rule.declarations.display) {
        log("STYLE","DEBUG","Display declaration found", { selector: (rule as any).selector, display: rule.declarations.display });
      }
      Object.assign(aggregated, rule.declarations);
    }
  }

  // Apply inline styles (highest priority)
  const inlineStyle = parseInlineStyle(element.getAttribute("style") ?? "");
  if (Object.keys(inlineStyle).length > 0) {
    log("STYLE","DEBUG","inline style applied", { declarations: inlineStyle });
  }
  Object.assign(aggregated, inlineStyle);

  // Apply declarations to style accumulator
  applyDeclarationsToStyle(aggregated, styleInit, inherited.fontWeight ?? mergedDefaults.fontWeight);

  // Determine final display value
  const defaultDisplay = defaultDisplayForTag(tagName);
  let display = styleInit.display ?? defaultDisplay;

  log("STYLE", "DEBUG", "computeStyleForElement display", {
    tagName,
    styleInitDisplay: styleInit.display,
    defaultDisplay,
    finalDisplay: display
  });

  // Force correct display for table elements if they're not set correctly
  if (tagName === 'table') {
    if (display !== Display.Table) {
      log("STYLE", "DEBUG", "Forcing table display", { tagName, originalDisplay: display });
      display = Display.Table;
    }
  } else if (tagName === 'thead' || tagName === 'tbody' || tagName === 'tfoot') {
    if (display !== Display.TableRowGroup) {
      log("STYLE", "DEBUG", "Forcing table-row-group display", { tagName, originalDisplay: display });
      display = Display.TableRowGroup;
    }
  } else if (tagName === 'tr') {
    if (display !== Display.TableRow) {
      log("STYLE", "DEBUG", "Forcing table-row display", { tagName, originalDisplay: display });
      display = Display.TableRow;
    }
  } else if (tagName === 'td' || tagName === 'th') {
    if (display !== Display.TableCell) {
      log("STYLE", "DEBUG", "Forcing table-cell display", { tagName, originalDisplay: display });
      display = Display.TableCell;
    }
  }

  const floatValue = mapFloat(styleInit.float);

  // Build final style options with proper precedence:
  // 1. Base browser defaults
  // 2. Element-specific defaults
  // 3. Inherited values
  // 4. CSS rules
  // 5. Inline styles (already applied in aggregated)
  const elementDefinesFontWeight = elementDefaults.fontWeight !== undefined;
  const elementDefinesFontSize = mergedDefaults.fontSize !== baseDefaults.fontSize;
  const elementDefinesLineHeight = mergedDefaults.lineHeight !== baseDefaults.lineHeight;

  const styleOptions: Partial<StyleProperties> = {
    // Start with merged defaults
    ...mergedDefaults,
    // Override with inherited values
    color: inherited.color,
    fontSize: elementDefinesFontSize ? mergedDefaults.fontSize : inherited.fontSize,
    lineHeight: elementDefinesLineHeight ? mergedDefaults.lineHeight : inherited.lineHeight,
    fontFamily: inherited.fontFamily,
    fontWeight: elementDefinesFontWeight ? mergedDefaults.fontWeight : normalizeFontWeight(inherited.fontWeight),
    // Apply computed values
    display,
    float: floatValue ?? FloatMode.None,
    borderModel: styleInit.borderModel ?? mergedDefaults.borderModel,
  };

  // Apply specific overrides from CSS/inline styles
  if (styleInit.color !== undefined) styleOptions.color = styleInit.color;
  if (styleInit.backgroundColor !== undefined) styleOptions.backgroundColor = styleInit.backgroundColor;
  if (styleInit.borderColor !== undefined) styleOptions.borderColor = styleInit.borderColor;
  if (styleInit.fontSize !== undefined) styleOptions.fontSize = styleInit.fontSize;
  if (styleInit.lineHeight !== undefined) styleOptions.lineHeight = styleInit.lineHeight;
  if (styleInit.fontFamily !== undefined) styleOptions.fontFamily = styleInit.fontFamily;
  if (styleInit.fontWeight !== undefined) styleOptions.fontWeight = normalizeFontWeight(styleInit.fontWeight);
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
  let display: Display;
  switch (tag) {
    case "span":
    case "a":
    case "strong":
    case "em":
    case "label":
    case "code":
    case "small":
    case "time":
      display = Display.Inline;
      break;
    case "table":
      display = Display.Table;
      break;
    case "tbody":
    case "thead":
    case "tfoot":
      display = Display.TableRowGroup;
      break;
    case "tr":
      display = Display.TableRow;
      break;
    case "td":
    case "th":
      display = Display.TableCell;
      break;
    case "caption":
      display = Display.TableCaption;
      break;
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
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      display = Display.Block;
      break;
    default:
      display = Display.Block;
      break;
  }
  log("STYLE", "TRACE", "defaultDisplayForTag", { tag, display });
  return display;
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

function applyDeclarationsToStyle(declarations: Record<string, string>, target: StyleAccumulator, inheritedFontWeight?: number): void {
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
        applyBorderColorShorthand(value, (color) => {
          target.borderColor = color;
        });
        break;
      case "border":
        applyBorderShorthand(value, (width) => {
          target.borderTop = width;
          target.borderRight = width;
          target.borderBottom = width;
          target.borderLeft = width;
        }, (color) => {
          target.borderColor = color ?? target.borderColor;
        });
        break;
      case "border-top":
        applyBorderShorthand(value, (width) => {
          target.borderTop = width;
        }, (color) => {
          target.borderColor = color ?? target.borderColor;
        });
        break;
      case "border-right":
        applyBorderShorthand(value, (width) => {
          target.borderRight = width;
        }, (color) => {
          target.borderColor = color ?? target.borderColor;
        });
        break;
      case "border-bottom":
        applyBorderShorthand(value, (width) => {
          target.borderBottom = width;
        }, (color) => {
          target.borderColor = color ?? target.borderColor;
        });
        break;
      case "border-left":
        applyBorderShorthand(value, (width) => {
          target.borderLeft = width;
        }, (color) => {
          target.borderColor = color ?? target.borderColor;
        });
        break;
      case "border-width":
        applyBoxShorthand(value, (top, right, bottom, left) => {
          target.borderTop = top;
          target.borderRight = right;
          target.borderBottom = bottom;
          target.borderLeft = left;
        }, parseBorderWidth);
        break;
      case "border-top-width":
        target.borderTop = parseBorderWidth(value) ?? target.borderTop;
        break;
      case "border-right-width":
        target.borderRight = parseBorderWidth(value) ?? target.borderRight;
        break;
      case "border-bottom-width":
        target.borderBottom = parseBorderWidth(value) ?? target.borderBottom;
        break;
      case "border-left-width":
        target.borderLeft = parseBorderWidth(value) ?? target.borderLeft;
        break;
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
        if (value.trim()) {
          target.borderColor = value.trim();
        }
        break;
      case "border-style":
        applyBorderStyleShorthand(value, (style) => {
          if (style === "none" || style === "hidden") {
            target.borderTop = 0;
            target.borderRight = 0;
            target.borderBottom = 0;
            target.borderLeft = 0;
          }
        });
        break;
      case "border-top-style":
        if (isNoneBorderStyle(value)) {
          target.borderTop = 0;
        }
        break;
      case "border-right-style":
        if (isNoneBorderStyle(value)) {
          target.borderRight = 0;
        }
        break;
      case "border-bottom-style":
        if (isNoneBorderStyle(value)) {
          target.borderBottom = 0;
        }
        break;
      case "border-left-style":
        if (isNoneBorderStyle(value)) {
          target.borderLeft = 0;
        }
        break;
      case "border-collapse": {
        const keyword = value.trim().toLowerCase();
        target.borderModel = keyword === "collapse" ? BorderModel.Collapse : BorderModel.Separate;
        break;
      }
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
      case "font-weight": {
        const parsed = parseFontWeightValue(value, inheritedFontWeight);
        if (parsed !== undefined) {
          target.fontWeight = parsed;
        }
        break;
      }
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
  parser: (input: string) => number | undefined = parseLength,
): void {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return;
  }
  const resolved = parts.map((part) => parser(part));
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

const BORDER_STYLE_KEYWORDS = new Set([
  "none",
  "hidden",
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

const BORDER_WIDTH_KEYWORD_MAP: Record<string, number> = {
  thin: 1,
  medium: 3,
  thick: 5,
};

const DEFAULT_BORDER_WIDTH = BORDER_WIDTH_KEYWORD_MAP.medium;

interface ParsedBorder {
  width?: number;
  style?: string;
  color?: string;
}

function applyBorderShorthand(
  value: string,
  applyWidth: (width: number) => void,
  applyColor: (color: string | undefined) => void,
): void {
  const parsed = parseBorderShorthand(value);
  if (!parsed) {
    return;
  }

  if (parsed.style === "none" || parsed.style === "hidden") {
    applyWidth(0);
  } else if (parsed.width !== undefined) {
    applyWidth(parsed.width);
  } else if (parsed.style) {
    applyWidth(DEFAULT_BORDER_WIDTH);
  }

  if (parsed.color !== undefined) {
    applyColor(parsed.color);
  }
}

function applyBorderColorShorthand(value: string, applyColor: (color: string) => void): void {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return;
  }
  const [top] =
    parts.length === 1
      ? [parts[0], parts[0], parts[0], parts[0]]
      : parts.length === 2
        ? [parts[0], parts[1], parts[0], parts[1]]
        : parts.length === 3
          ? [parts[0], parts[1], parts[2], parts[1]]
          : [parts[0], parts[1], parts[2], parts[3]];
  if (top) {
    applyColor(top);
  }
}

function applyBorderStyleShorthand(value: string, apply: (style: string | undefined) => void): void {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return;
  }
  apply(parts[0]?.toLowerCase());
}

function isNoneBorderStyle(value: string): boolean {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return false;
  }
  const keyword = parts[0]?.toLowerCase();
  return keyword === "none" || keyword === "hidden";
}

function parseBorderShorthand(value: string): ParsedBorder | null {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return null;
  }

  let width: number | undefined;
  let style: string | undefined;
  let color: string | undefined;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    if (width === undefined) {
      const maybeWidth = parseBorderWidth(trimmed);
      if (maybeWidth !== undefined) {
        width = maybeWidth;
        continue;
      }
    }

    const lower = trimmed.toLowerCase();
    if (!style && BORDER_STYLE_KEYWORDS.has(lower)) {
      style = lower;
      continue;
    }

    if (color === undefined) {
      color = trimmed;
    }
  }

  if (style === "none" || style === "hidden") {
    width = 0;
  } else if (width === undefined && style) {
    width = DEFAULT_BORDER_WIDTH;
  }

  return { width, style, color };
}

function parseBorderWidth(value: string): number | undefined {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed in BORDER_WIDTH_KEYWORD_MAP) {
    return BORDER_WIDTH_KEYWORD_MAP[trimmed];
  }
  return parseLength(value);
}

function splitCssList(value: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;

  for (const char of value) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (/\s/.test(char) && depth === 0) {
      if (current.trim()) {
        result.push(current.trim());
      }
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
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
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px|pt)?$/i);
  if (!match) {
    return undefined;
  }
  let n = Number.parseFloat(match[1]);
  if ((match[2] ?? '').toLowerCase() === 'pt') n = ptToPx(n);
  return n;
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
    case "table":
      return Display.Table;
    case "table-row":
      return Display.TableRow;
    case "table-cell":
      return Display.TableCell;
    case "table-row-group":
      return Display.TableRowGroup;
    case "table-header-group":
      return Display.TableHeaderGroup;
    case "table-footer-group":
      return Display.TableFooterGroup;
    case "table-caption":
      return Display.TableCaption;
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

export function resolvePageMarginsPx(pageWidthPx: number, pageHeightPx: number): PageMarginsPx {
  const margins = { ...DEFAULT_PAGE_MARGINS_PX };
  const horizontalSum = margins.left + margins.right;
  const verticalSum = margins.top + margins.bottom;
  const usableWidth = maxContentDimension(pageWidthPx, 0);
  const usableHeight = maxContentDimension(pageHeightPx, 0);

  if (horizontalSum > usableWidth) {
    const scale = usableWidth / (horizontalSum || 1);
    margins.left *= scale;
    margins.right *= scale;
  }
  if (verticalSum > usableHeight) {
    const scale = usableHeight / (verticalSum || 1);
    margins.top *= scale;
    margins.bottom *= scale;
  }
  return margins;
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

export function sanitizeDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value ?? NaN)) {
    return fallback;
  }
  const sanitized = Number(value);
  return sanitized > 0 ? sanitized : fallback;
}

export function maxContentDimension(total: number, marginsSum: number): number {
  return Math.max(1, total - marginsSum);
}

export function ptToPx(pt: number): number {
  return (pt / 72) * 96;
}

export function pxToPt(px: number): number {
  return (px / 96) * 72;
}
