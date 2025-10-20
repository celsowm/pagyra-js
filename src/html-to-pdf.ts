import { parseHTML } from "linkedom";
import * as cssParser from "css";
import path from "node:path";

import { LayoutNode } from "./dom/node.js";
import { ComputedStyle } from "./css/style.js";
import type { StyleProperties, BoxShadow, AlignSelfValue, FlexDirection } from "./css/style.js";
import { BorderModel, Display, FloatMode, AlignItems, JustifyContent, AlignContent } from "./css/enums.js";
import { BrowserDefaults, ElementSpecificDefaults } from "./css/browser-defaults.js";
import { parseFontWeightValue, normalizeFontWeight } from "./css/font-weight.js";
import { layoutTree } from "./layout/pipeline/layout-tree.js";
import { buildRenderTree } from "./pdf/layout-tree-builder.js";
import { renderPdf } from "./pdf/render.js";
import type { RenderBox, Rect } from "./pdf/types.js";
import { ImageService } from "./image/image-service.js";
import { ImageStrategy } from "./layout/strategies/image.js";
import type { ImageInfo } from "./image/types.js";
import { makeUnitParsers, type UnitCtx } from './units/units.js';
import { parseCss } from './html/css/parse-css.js';
import type { CssRuleEntry, DomEl } from './html/css/parse-css.js';
import { configureDebug, log, type LogCat, type LogLevel } from "./debug/log.js";

interface StyleAccumulator {
  display?: Display;
  float?: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  boxShadows?: BoxShadow[];
  borderTop?: number;
  borderRight?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderTopLeftRadiusX?: number;
  borderTopLeftRadiusY?: number;
  borderTopRightRadiusX?: number;
  borderTopRightRadiusY?: number;
  borderBottomRightRadiusX?: number;
  borderBottomRightRadiusY?: number;
  borderBottomLeftRadiusX?: number;
  borderBottomLeftRadiusY?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  width?: number;
  minWidth?: number;
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
  fontWeight?: number;
  borderModel?: BorderModel;
  maxWidth?: number;
  textAlign?: string;
  objectFit?: string;
  backgroundSize?: string;
  textDecorationLine?: string;
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;
  alignContent?: AlignContent;
  alignSelf?: AlignSelfValue;
  flexDirection?: FlexDirection;
  flexWrap?: boolean;
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
  resourceBaseDir?: string;
  assetRootDir?: string;
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
  const prepared = await prepareHtmlRender(options);
  return renderPdf(prepared.renderTree, { pageSize: prepared.pageSize, fontConfig: options.fontConfig });
}

export interface PreparedRender {
  layoutRoot: LayoutNode;
  renderTree: ReturnType<typeof buildRenderTree>;
  pageSize: { widthPt: number; heightPt: number };
}

interface ConversionContext {
  resourceBaseDir: string;
  assetRootDir: string;
  units: UnitParsers;
}

let CURRENT_VIEWPORT_WIDTH_PX = 0;
let CURRENT_VIEWPORT_HEIGHT_PX = 0;

function setViewportSize(width: number, height: number): void {
  CURRENT_VIEWPORT_WIDTH_PX = Number.isFinite(width) && width > 0 ? width : 0;
  CURRENT_VIEWPORT_HEIGHT_PX = Number.isFinite(height) && height > 0 ? height : 0;
}

export async function prepareHtmlRender(options: RenderHtmlOptions): Promise<PreparedRender> {
  const { html, css, viewportWidth, viewportHeight, pageWidth, pageHeight, margins, debug = false, debugLevel, debugCats } = options;
  setViewportSize(viewportWidth, viewportHeight);

  // Configure debugging backward compatibility: debug=true => DEBUG level with RENDER_TREE category
  if (debugLevel || debugCats) {
    configureDebug(debugLevel ?? (debug ? "DEBUG" : "INFO"), debugCats ?? (debug ? ["RENDER_TREE"] : []));
  } else if (debug) {
    configureDebug("DEBUG", ["RENDER_TREE"]);
  }

  const unitCtx: UnitCtx = { viewport: { width: viewportWidth, height: viewportHeight } };
  const units = makeUnitParsers(unitCtx);

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
  const cssRules = parseCss(mergedCss);
  log("PARSE","DEBUG","CSS rules", { count: cssRules.length });

  const baseParentStyle = new ComputedStyle();
  const bodyElement = (document.body ?? document.documentElement) as DomEl | null;
  const rootStyle = bodyElement ? computeStyleForElement(bodyElement, cssRules, baseParentStyle, units) : baseParentStyle;
  const rootTagName = bodyElement?.tagName ? bodyElement.tagName.toLowerCase() : undefined;
  const rootLayout = new LayoutNode(rootStyle, [], { tagName: rootTagName });

  const resourceBaseDir = path.resolve(options.resourceBaseDir ?? options.assetRootDir ?? process.cwd());
  const assetRootDir = path.resolve(options.assetRootDir ?? resourceBaseDir);
  const context: ConversionContext = { resourceBaseDir, assetRootDir, units };

  if (bodyElement) {
    const childNodes = Array.from(bodyElement.childNodes ?? []) as Node[];
    for (const child of childNodes) {
      const layoutChild = await convertDomNode(child, cssRules, rootStyle, context);
      if (layoutChild) {
        rootLayout.appendChild(layoutChild);
      }
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

async function convertDomNode(
  node: Node,
  cssRules: CssRuleEntry[],
  parentStyle: ComputedStyle,
  context: ConversionContext,
): Promise<LayoutNode | null> {
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

  const element = node as DomEl;
  const tagName = element.tagName.toLowerCase();
  if (tagName === "script" || tagName === "style") return null;

  // Handle image elements
  if (tagName === "img") {
    return await convertImageElement(element, cssRules, parentStyle, context);
  }

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
  const ownStyle = computeStyleForElement(element, cssRules, parentStyle, context.units);
  const layoutChildren: LayoutNode[] = [];
  let textBuf = "";

  for (const child of Array.from(element.childNodes) as Node[]) {
    if (child.nodeType === child.TEXT_NODE) {
      textBuf += child.textContent ?? "";
      continue;
    }
    if (textBuf) {
      let normalized = textBuf.replace(/\s+/g, " ").normalize("NFC");
      if (normalized.trim().length === 0) {
        normalized = layoutChildren.length > 0 ? " " : "";
      }
      if (normalized) {
        layoutChildren.push(new LayoutNode(new ComputedStyle({
          display: Display.Inline,
          color: ownStyle.color,
          fontSize: ownStyle.fontSize,
          lineHeight: ownStyle.lineHeight,
          fontFamily: ownStyle.fontFamily,
          fontWeight: ownStyle.fontWeight,
          textDecorationLine: ownStyle.textDecorationLine,
        }), [], { textContent: normalized }));
      }
      textBuf = "";
    }
    const sub = await convertDomNode(child, cssRules, ownStyle, context);
    if (sub) layoutChildren.push(sub);
  }
  if (textBuf) {
    let normalized = textBuf.replace(/\s+/g, " ").normalize("NFC");
    if (normalized.trim().length === 0) {
      normalized = layoutChildren.length > 0 ? " " : "";
    }
    if (normalized) {
      layoutChildren.push(new LayoutNode(new ComputedStyle({
        display: Display.Inline,
        color: ownStyle.color,
        fontSize: ownStyle.fontSize,
        lineHeight: ownStyle.lineHeight,
        fontFamily: ownStyle.fontFamily,
        fontWeight: ownStyle.fontWeight,
        textDecorationLine: ownStyle.textDecorationLine,
      }), [], { textContent: normalized }));
    }
  }

  return new LayoutNode(ownStyle, layoutChildren, { tagName });
}

function computeStyleForElement(element: DomEl, cssRules: CssRuleEntry[], parentStyle: ComputedStyle, units: UnitParsers): ComputedStyle {
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
    textDecorationLine: parentStyle.textDecorationLine ?? mergedDefaults.textDecorationLine,
  };

  const styleInit: StyleAccumulator = {};
  const aggregated: Record<string, string> = {};

  // Apply CSS rules
  for (const rule of cssRules) {
    if (rule.match(element)) {
      log("STYLE","DEBUG","CSS rule matched", { selector: rule.selector, declarations: rule.declarations });
      if (rule.declarations.display) {
        log("STYLE","DEBUG","Display declaration found", { selector: rule.selector, display: rule.declarations.display });
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
  applyDeclarationsToStyle(aggregated, styleInit, units, inherited.fontWeight ?? mergedDefaults.fontWeight);

  // Determine final display value
  const defaultDisplay = mergedDefaults.display ?? defaultDisplayForTag(tagName);
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
  if (styleInit.boxShadows !== undefined) styleOptions.boxShadows = [...styleInit.boxShadows];
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
  if (styleInit.borderTopLeftRadiusX !== undefined) styleOptions.borderTopLeftRadiusX = styleInit.borderTopLeftRadiusX;
  if (styleInit.borderTopLeftRadiusY !== undefined) styleOptions.borderTopLeftRadiusY = styleInit.borderTopLeftRadiusY;
  if (styleInit.borderTopRightRadiusX !== undefined) styleOptions.borderTopRightRadiusX = styleInit.borderTopRightRadiusX;
  if (styleInit.borderTopRightRadiusY !== undefined) styleOptions.borderTopRightRadiusY = styleInit.borderTopRightRadiusY;
  if (styleInit.borderBottomRightRadiusX !== undefined) styleOptions.borderBottomRightRadiusX = styleInit.borderBottomRightRadiusX;
  if (styleInit.borderBottomRightRadiusY !== undefined) styleOptions.borderBottomRightRadiusY = styleInit.borderBottomRightRadiusY;
  if (styleInit.borderBottomLeftRadiusX !== undefined) styleOptions.borderBottomLeftRadiusX = styleInit.borderBottomLeftRadiusX;
  if (styleInit.borderBottomLeftRadiusY !== undefined) styleOptions.borderBottomLeftRadiusY = styleInit.borderBottomLeftRadiusY;
  if (styleInit.width !== undefined) styleOptions.width = styleInit.width;
  if (styleInit.minWidth !== undefined) styleOptions.minWidth = styleInit.minWidth;
  if (styleInit.maxWidth !== undefined) styleOptions.maxWidth = styleInit.maxWidth;
  if (styleInit.height !== undefined) styleOptions.height = styleInit.height;
  if (styleInit.minHeight !== undefined) styleOptions.minHeight = styleInit.minHeight;
  if (styleInit.maxHeight !== undefined) styleOptions.maxHeight = styleInit.maxHeight;
  if (styleInit.justifyContent !== undefined) styleOptions.justifyContent = styleInit.justifyContent;
  if (styleInit.alignItems !== undefined) styleOptions.alignItems = styleInit.alignItems;
  if (styleInit.alignContent !== undefined) styleOptions.alignContent = styleInit.alignContent;
  if (styleInit.alignSelf !== undefined) styleOptions.alignSelf = styleInit.alignSelf;
  if (styleInit.flexDirection !== undefined) styleOptions.flexDirection = styleInit.flexDirection;
  if (styleInit.flexWrap !== undefined) styleOptions.flexWrap = styleInit.flexWrap;
  if (styleInit.textAlign !== undefined) styleOptions.textAlign = styleInit.textAlign;
  if (styleInit.objectFit !== undefined) {
    styleOptions.objectFit = styleInit.objectFit as StyleProperties["objectFit"];
  }
  if (styleInit.backgroundSize !== undefined) styleOptions.backgroundSize = styleInit.backgroundSize;
  const defaultDecoration = mergedDefaults.textDecorationLine ?? "none";
  let decoration = inherited.textDecorationLine ?? defaultDecoration;
  if (elementDefaults.textDecorationLine !== undefined) {
    decoration = elementDefaults.textDecorationLine;
  }
  if (styleInit.textDecorationLine !== undefined) {
    decoration = styleInit.textDecorationLine;
  }
  styleOptions.textDecorationLine = decoration;

  return new ComputedStyle(styleOptions);
}

function defaultDisplayForTag(tag: string): Display {
  let display: Display;
  switch (tag) {
    case "span":
    case "a":
    case "strong":
    case "em":
    case "b":
    case "s":
    case "strike":
    case "del":
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

function parseTextDecorationLine(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const tokens = value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) {
    return undefined;
  }
  if (tokens.includes("none")) {
    return "none";
  }
  const allowed = new Set(["underline", "overline", "line-through"]);
  const matches = tokens.filter((token) => allowed.has(token));
  if (matches.length === 0) {
    return undefined;
  }
  const unique = [...new Set(matches)];
  return unique.join(" ");
}

interface UnitParsers {
  parseLength: (v: string) => number | undefined;
}

function applyDeclarationsToStyle(declarations: Record<string, string>, target: StyleAccumulator, units: UnitParsers, inheritedFontWeight?: number): void {
  for (const [property, value] of Object.entries(declarations)) {
    switch (property) {
      case "display":
        target.display = mapDisplay(value);
        break;
      case "justify-content": {
        const mapped = mapJustifyContent(value);
        if (mapped !== undefined) {
          target.justifyContent = mapped;
        }
        break;
      }
      case "align-items": {
        const mapped = mapAlignItemsValue(value);
        if (mapped !== undefined) {
          target.alignItems = mapped;
        }
        break;
      }
      case "align-content": {
        const mapped = mapAlignContentValue(value);
        if (mapped !== undefined) {
          target.alignContent = mapped;
        }
        break;
      }
      case "align-self": {
        const mapped = mapAlignSelfValue(value);
        if (mapped !== undefined) {
          target.alignSelf = mapped;
        }
        break;
      }
      case "flex-direction": {
        const mapped = parseFlexDirectionValue(value);
        if (mapped !== undefined) {
          target.flexDirection = mapped;
        }
        break;
      }
      case "flex-wrap": {
        const normalized = value.trim().toLowerCase();
        if (normalized === "nowrap") {
          target.flexWrap = false;
        } else if (normalized === "wrap" || normalized === "wrap-reverse") {
          target.flexWrap = true;
        }
        break;
      }
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
      case "box-shadow": {
        const parsed = parseBoxShadowList(value);
        if (parsed !== undefined) {
          target.boxShadows = parsed;
        }
        break;
      }
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
      case "border-radius": {
        const parsed = parseBorderRadiusShorthand(value);
        if (parsed) {
          target.borderTopLeftRadiusX = parsed.topLeft.x;
          target.borderTopLeftRadiusY = parsed.topLeft.y;
          target.borderTopRightRadiusX = parsed.topRight.x;
          target.borderTopRightRadiusY = parsed.topRight.y;
          target.borderBottomRightRadiusX = parsed.bottomRight.x;
          target.borderBottomRightRadiusY = parsed.bottomRight.y;
          target.borderBottomLeftRadiusX = parsed.bottomLeft.x;
          target.borderBottomLeftRadiusY = parsed.bottomLeft.y;
        }
        break;
      }
      case "border-top-left-radius": {
        const parsed = parseBorderCornerRadius(value);
        if (parsed) {
          target.borderTopLeftRadiusX = parsed.x;
          target.borderTopLeftRadiusY = parsed.y;
        }
        break;
      }
      case "border-top-right-radius": {
        const parsed = parseBorderCornerRadius(value);
        if (parsed) {
          target.borderTopRightRadiusX = parsed.x;
          target.borderTopRightRadiusY = parsed.y;
        }
        break;
      }
      case "border-bottom-right-radius": {
        const parsed = parseBorderCornerRadius(value);
        if (parsed) {
          target.borderBottomRightRadiusX = parsed.x;
          target.borderBottomRightRadiusY = parsed.y;
        }
        break;
      }
      case "border-bottom-left-radius": {
        const parsed = parseBorderCornerRadius(value);
        if (parsed) {
          target.borderBottomLeftRadiusX = parsed.x;
          target.borderBottomLeftRadiusY = parsed.y;
        }
        break;
      }
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
      case "min-width":
        target.minWidth = parseLength(value) ?? target.minWidth;
        break;
      case "max-width":
        target.maxWidth = parseLength(value) ?? target.maxWidth;
        break;
      case "height":
        target.height = parseLength(value) ?? target.height;
        break;
      case "min-height":
        target.minHeight = parseLength(value) ?? target.minHeight;
        break;
      case "max-height":
        target.maxHeight = parseLength(value) ?? target.maxHeight;
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
      case "text-align":
        target.textAlign = value.toLowerCase();
        break;
      case "text-decoration":
      case "text-decoration-line": {
        const parsed = parseTextDecorationLine(value);
        if (parsed !== undefined) {
          target.textDecorationLine = parsed;
        }
        break;
      }
      case "float":
        target.float = value;
        break;
      case "object-fit": {
        const normalized = value.trim().toLowerCase();
        if (["contain", "cover", "fill", "none", "scale-down"].includes(normalized)) {
          target.objectFit = normalized;
        }
        break;
      }
      case "background-size":
        target.backgroundSize = value.trim();
        break;
      default:
        break;
    }
  }
}

interface ParsedCornerRadiusPair {
  x: number;
  y: number;
}

interface ParsedBorderRadius {
  topLeft: ParsedCornerRadiusPair;
  topRight: ParsedCornerRadiusPair;
  bottomRight: ParsedCornerRadiusPair;
  bottomLeft: ParsedCornerRadiusPair;
}

function parseBorderRadiusShorthand(value: string): ParsedBorderRadius | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const [horizontalPart, verticalPart] = trimmed.split("/").map((part) => part.trim());
  const horizontalValues = expandBorderRadiusList(horizontalPart);
  if (!horizontalValues) {
    return null;
  }
  const verticalValues = verticalPart ? expandBorderRadiusList(verticalPart) : horizontalValues;
  if (!verticalValues) {
    return null;
  }
  return {
    topLeft: { x: horizontalValues[0], y: verticalValues[0] },
    topRight: { x: horizontalValues[1], y: verticalValues[1] },
    bottomRight: { x: horizontalValues[2], y: verticalValues[2] },
    bottomLeft: { x: horizontalValues[3], y: verticalValues[3] },
  };
}

function parseBorderCornerRadius(value: string): ParsedCornerRadiusPair | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const [horizontalRaw, verticalRaw] = trimmed.split("/").map((part) => part.trim());
  const horizontalList = splitCssList(horizontalRaw);
  if (horizontalList.length === 0) {
    return undefined;
  }
  const horizontal = clampPositive(parseLength(horizontalList[0]));
  let vertical: number;
  if (verticalRaw) {
    const verticalList = splitCssList(verticalRaw);
    vertical = clampPositive(parseLength(verticalList[0]));
  } else if (horizontalList.length > 1) {
    vertical = clampPositive(parseLength(horizontalList[1]));
  } else {
    vertical = horizontal;
  }
  return { x: horizontal, y: vertical };
}

function expandBorderRadiusList(input: string | undefined): [number, number, number, number] | null {
  if (!input) {
    return null;
  }
  const parts = splitCssList(input);
  if (parts.length === 0) {
    return null;
  }
  const resolved = parts.map((part) => clampPositive(parseLength(part)));
  switch (resolved.length) {
    case 1:
      return [resolved[0], resolved[0], resolved[0], resolved[0]];
    case 2:
      return [resolved[0], resolved[1], resolved[0], resolved[1]];
    case 3:
      return [resolved[0], resolved[1], resolved[2], resolved[1]];
    default:
      return [resolved[0], resolved[1], resolved[2], resolved[3]];
  }
}

function clampPositive(value: number | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 0;
  }
  const numeric = Number(value);
  return numeric > 0 ? numeric : 0;
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

function parseBoxShadowList(value: string): BoxShadow[] | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const keyword = trimmed.toLowerCase();
  if (keyword === "none" || keyword === "initial") {
    return [];
  }
  if (keyword === "inherit" || keyword === "revert" || keyword === "revert-layer") {
    return undefined;
  }
  const layers = splitCssCommaList(trimmed);
  const result: BoxShadow[] = [];
  for (const layer of layers) {
    const parsed = parseSingleBoxShadow(layer);
    if (parsed) {
      result.push(parsed);
    }
  }
  return result;
}

function parseSingleBoxShadow(input: string): BoxShadow | null {
  const tokens = splitCssList(input);
  if (tokens.length === 0) {
    return null;
  }
  let inset = false;
  const lengths: number[] = [];
  let color: string | undefined;

  for (const token of tokens) {
    const lowered = token.toLowerCase();
    if (lowered === "inset") {
      inset = true;
      continue;
    }
    const length = parseLength(token);
    if (length !== undefined) {
      lengths.push(length);
      continue;
    }
    if (color === undefined) {
      color = token;
      continue;
    }
    return null;
  }

  if (lengths.length < 2) {
    return null;
  }

  const offsetX = lengths[0];
  const offsetY = lengths[1];
  const blurRadius = clampNonNegative(lengths[2] ?? 0);
  const spreadRadius = lengths[3] ?? 0;

  return {
    inset,
    offsetX,
    offsetY,
    blurRadius,
    spreadRadius,
    color,
  };
}

function splitCssCommaList(value: string): string[] {
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
    if (char === "," && depth === 0) {
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

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value;
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
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "auto") {
    return undefined;
  }
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(px|pt|vh|vw)?$/);
  if (!match) {
    return undefined;
  }
  const numeric = Number.parseFloat(match[1]);
  if (Number.isNaN(numeric)) {
    return undefined;
  }
  const unit = match[2] ?? "px";
  switch (unit) {
    case "px":
      return numeric;
    case "pt":
      return ptToPx(numeric);
    case "vh":
      return (numeric / 100) * CURRENT_VIEWPORT_HEIGHT_PX;
    case "vw":
      return (numeric / 100) * CURRENT_VIEWPORT_WIDTH_PX;
    default:
      return undefined;
  }
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

function mapJustifyContent(value: string | undefined): JustifyContent | undefined {
  if (!value) {
    return undefined;
  }
  switch (value.trim().toLowerCase()) {
    case "flex-start":
      return JustifyContent.FlexStart;
    case "flex-end":
      return JustifyContent.FlexEnd;
    case "center":
      return JustifyContent.Center;
    case "space-between":
      return JustifyContent.SpaceBetween;
    case "space-around":
      return JustifyContent.SpaceAround;
    case "space-evenly":
      return JustifyContent.SpaceEvenly;
    case "start":
      return JustifyContent.Start;
    case "end":
      return JustifyContent.End;
    case "left":
      return JustifyContent.Left;
    case "right":
      return JustifyContent.Right;
    default:
      return undefined;
  }
}

function mapAlignItemsValue(value: string | undefined): AlignItems | undefined {
  if (!value) {
    return undefined;
  }
  switch (value.trim().toLowerCase()) {
    case "flex-start":
      return AlignItems.FlexStart;
    case "flex-end":
      return AlignItems.FlexEnd;
    case "center":
      return AlignItems.Center;
    case "baseline":
      return AlignItems.Baseline;
    case "stretch":
      return AlignItems.Stretch;
    default:
      return undefined;
  }
}

function mapAlignContentValue(value: string | undefined): AlignContent | undefined {
  if (!value) {
    return undefined;
  }
  switch (value.trim().toLowerCase()) {
    case "flex-start":
      return AlignContent.FlexStart;
    case "flex-end":
      return AlignContent.FlexEnd;
    case "center":
      return AlignContent.Center;
    case "space-between":
      return AlignContent.SpaceBetween;
    case "space-around":
      return AlignContent.SpaceAround;
    case "space-evenly":
      return AlignContent.SpaceEvenly;
    case "stretch":
      return AlignContent.Stretch;
    default:
      return undefined;
  }
}

function mapAlignSelfValue(value: string | undefined): AlignSelfValue | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") {
    return "auto";
  }
  return mapAlignItemsValue(normalized);
}

function parseFlexDirectionValue(value: string | undefined): FlexDirection | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "row":
    case "row-reverse":
    case "column":
    case "column-reverse":
      return normalized as FlexDirection;
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

/**
 * Converts an HTML img element to a LayoutNode with proper image handling
 */
async function convertImageElement(
  element: DomEl,
  cssRules: CssRuleEntry[],
  parentStyle: ComputedStyle,
  context: ConversionContext,
): Promise<LayoutNode> {
  const style = computeStyleForElement(element, cssRules, parentStyle, context.units);
  const srcAttr = element.getAttribute("src")?.trim() ?? "";

  const widthAttr = element.getAttribute("width");
  const heightAttr = element.getAttribute("height");
  const width = widthAttr ? Number.parseFloat(widthAttr) || undefined : undefined;
  const height = heightAttr ? Number.parseFloat(heightAttr) || undefined : undefined;

  if (!srcAttr) {
    const placeholder = new LayoutNode(style, [], { tagName: "img" });
    placeholder.intrinsicInlineSize = width ?? 100;
    placeholder.intrinsicBlockSize = height ?? 100;
    return placeholder;
  }

  const resolvedSrc = resolveImageSource(srcAttr, context);

  let imageInfo: ImageInfo;
  try {
    if (isHttpUrl(resolvedSrc)) {
      throw new Error(`Remote images are not supported (${resolvedSrc})`);
    }
    if (resolvedSrc.startsWith("data:")) {
      throw new Error("Data URI images are not supported yet.");
    }

    const imageService = ImageService.getInstance();
    imageInfo = await imageService.loadImage(resolvedSrc, {
      maxWidth: width,
      maxHeight: height,
    });

    log("RENDER_TREE", "DEBUG", "Image loaded successfully", {
      src: srcAttr,
      resolvedSrc,
      width: imageInfo.width,
      height: imageInfo.height,
      format: imageInfo.format,
    });
  } catch (error) {
    log("RENDER_TREE", "WARN", `Failed to load image: ${srcAttr}. Using placeholder.`, {
      resolvedSrc,
      error: error instanceof Error ? error.message : String(error),
    });
    const placeholder = new LayoutNode(style, [], { tagName: "img" });
    placeholder.intrinsicInlineSize = width ?? 100;
    placeholder.intrinsicBlockSize = height ?? 100;
    return placeholder;
  }

  const layoutNode = new LayoutNode(style, [], {
    tagName: "img",
    customData: {
      image: {
        originalSrc: srcAttr,
        resolvedSrc,
        info: imageInfo,
      },
    },
  });

  layoutNode.intrinsicInlineSize = imageInfo.width;
  layoutNode.intrinsicBlockSize = imageInfo.height;

  ImageStrategy.processImage(layoutNode, imageInfo);

  if (width && height) {
    layoutNode.intrinsicInlineSize = width;
    layoutNode.intrinsicBlockSize = height;
  } else if (width) {
    layoutNode.intrinsicInlineSize = width;
    layoutNode.intrinsicBlockSize = Math.round((imageInfo.height / imageInfo.width) * width);
  } else if (height) {
    layoutNode.intrinsicBlockSize = height;
    layoutNode.intrinsicInlineSize = Math.round((imageInfo.width / imageInfo.height) * height);
  }

  return layoutNode;
}

function resolveImageSource(src: string, context: ConversionContext): string {
  const trimmed = src.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^data:/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol === "file:") {
      return url.href;
    }
    return url.href;
  } catch {
    // Not an absolute URL, fall through to filesystem resolution
  }
  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return path.resolve(context.assetRootDir, `.${trimmed}`);
  }
  return path.resolve(context.resourceBaseDir, trimmed);
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
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
