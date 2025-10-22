import { FloatMode, OverflowMode, Position } from "../css/enums.js";
import type { ComputedStyle } from "../css/style.js";
import { LayoutNode } from "../dom/node.js";
import { resolveLength } from "../css/length.js";
import { parseLinearGradient } from "../css/parsers/gradient-parser.js";
import { GradientService } from "./shading/gradient-service.js";
import { CoordinateTransformer } from "./utils/coordinate-transformer.js";
import { log } from "../debug/log.js";
import {
  type LayoutTree,
  type RenderBox,
  type Rect,
  type HeaderFooterHTML,
  type StyleSheets,
  type Positioning,
  type RGBA,
  type Run,
  NodeKind,
  Overflow,
  LayerMode,
} from "./types.js";
import { parseColor } from "./utils/color-utils.js";
import { resolveBorderRadius } from "./utils/border-radius-utils.js";
import { createTextRuns, resolveDecorations } from "./utils/text-utils.js";
import { createListMarkerRun } from "./utils/list-utils.js";
import { resolveBoxShadows, calculateVisualOverflow } from "./utils/shadow-utils.js";
import { extractImageRef } from "./utils/image-utils.js";
import { calculateBoxDimensions } from "./utils/box-dimensions-utils.js";

// Note: We don't import NAMED_COLORS since it's no longer needed with the new color-utils module

export interface RenderTreeOptions {
  dpiAssumption?: number;
  stylesheets?: Partial<StyleSheets>;
  headerFooter?: Partial<HeaderFooterHTML>;
}

export function buildRenderTree(root: LayoutNode, options: RenderTreeOptions = {}): LayoutTree {
  const dpiAssumption = options.dpiAssumption ?? 96;
  const stylesheets: StyleSheets = {
    fontFaces: options.stylesheets?.fontFaces ?? [],
  };
  const headerFooter: HeaderFooterHTML = {
    headerHtml: options.headerFooter?.headerHtml,
    footerHtml: options.headerFooter?.footerHtml,
    headerFirstHtml: options.headerFooter?.headerFirstHtml,
    footerFirstHtml: options.headerFooter?.footerFirstHtml,
    headerEvenHtml: options.headerFooter?.headerEvenHtml,
    footerEvenHtml: options.headerFooter?.footerEvenHtml,
    headerOddHtml: options.headerFooter?.headerOddHtml,
    footerOddHtml: options.headerFooter?.footerOddHtml,
    placeholders: options.headerFooter?.placeholders ?? {},
    layerMode: options.headerFooter?.layerMode ?? LayerMode.Under,
    maxHeaderHeightPx: options.headerFooter?.maxHeaderHeightPx ?? 0,
    maxFooterHeightPx: options.headerFooter?.maxFooterHeightPx ?? 0,
    clipOverflow: options.headerFooter?.clipOverflow ?? false,
    fontFamily: options.headerFooter?.fontFamily,
  };

  const state = { counter: 0 };
  const renderRoot = convertNode(root, state);
  return {
    root: renderRoot,
    dpiAssumption,
    css: stylesheets,
    hf: headerFooter,
  };
}

const DEFAULT_TEXT_COLOR: RGBA = { r: 0, g: 0, b: 0, a: 1 };

// ====================
// UTILITY FUNCTIONS
// ====================

function mapNodeKind(node: LayoutNode): NodeKind {
  if (node.tagName === "img") {
    return NodeKind.Image;
  }
  if (node.tagName === "li") {
    return NodeKind.ListItem;
  }
  if (node.textContent && node.textContent.length > 0) {
    return NodeKind.TextRuns;
  }
  return NodeKind.Container;
}

function mapPosition(style: ComputedStyle): Positioning {
  if (style.float !== FloatMode.None) {
    return { type: "float" };
  }
  switch (style.position) {
    case Position.Absolute:
      return { type: "absolute" };
    case Position.Fixed:
      return { type: "fixed" };
    case Position.Sticky:
      return { type: "sticky" };
    default:
      return { type: "normal" };
  }
}

function mapOverflow(mode: OverflowMode): Overflow {
  switch (mode) {
    case OverflowMode.Hidden:
      return Overflow.Hidden;
    case OverflowMode.Scroll:
      return Overflow.Scroll;
    case OverflowMode.Auto:
      return Overflow.Auto;
    case OverflowMode.Clip:
      return Overflow.Clip;
    default:
      return Overflow.Visible;
  }
}

// ====================
// BACKGROUND HANDLING
// ====================

function handleBackground(style: ComputedStyle, borderBox: Rect): { color?: RGBA; image?: unknown; gradient?: unknown } {
  // Check for gradients first
  if (style.backgroundLayers) {
    const gradientLayer = style.backgroundLayers.find(layer => layer.kind === "gradient");
    if (gradientLayer) {
      return { gradient: gradientLayer.gradient };
    }
  }
  
  // Fall back to solid color
  const color = parseColor(style.backgroundColor || undefined);
  return { color };
}

// ====================
// MAIN CONVERSION FUNCTION
// ====================

function convertNode(node: LayoutNode, state: { counter: number }): RenderBox {
  const id = `node-${state.counter++}`;
  const { borderBox, paddingBox, contentBox } = calculateBoxDimensions(node);
  const textColor = parseColor(node.style.color);
  const fallbackShadowColor = textColor ?? DEFAULT_TEXT_COLOR;
  const boxShadows = resolveBoxShadows(node, fallbackShadowColor);
  const visualOverflow = calculateVisualOverflow(node, borderBox, boxShadows);
  const borderRadius = resolveBorderRadius(node.style, borderBox);

  const children = node.children.map((child) => convertNode(child, state));
  const imageRef = extractImageRef(node);
  const decorations = resolveDecorations(node.style);
  const textRuns = node.textContent ? createTextRuns(node, textColor, decorations) : [];
  if (node.tagName === "li") {
    const markerRun = createListMarkerRun(node, contentBox, children, textColor ?? DEFAULT_TEXT_COLOR);
    if (markerRun) {
      textRuns.unshift(markerRun);
    }
  }

  log("RENDER_TREE","DEBUG","node converted", {
    tagName: node.tagName,
    textContent: node.textContent?.slice(0, 40),
    fontFamily: node.style.fontFamily,
    fontSize: node.style.fontSize,
    contentBox,
  });

  // Handle background (both colors and gradients)
  const background = handleBackground(node.style, borderBox);
  
  return {
    id,
    tagName: node.tagName,
    textContent: node.textContent,
    kind: mapNodeKind(node),
    contentBox,
    paddingBox,
    borderBox,
    visualOverflow,
    padding: {
      top: resolveLength(node.style.paddingTop, Math.max(node.box.contentWidth, 0), { auto: "zero" }),
      right: resolveLength(node.style.paddingRight, Math.max(node.box.contentWidth, 0), { auto: "zero" }),
      bottom: resolveLength(node.style.paddingBottom, Math.max(node.box.contentWidth, 0), { auto: "zero" }),
      left: resolveLength(node.style.paddingLeft, Math.max(node.box.contentWidth, 0), { auto: "zero" }),
    },
    border: {
      top: resolveLength(node.style.borderTop, Math.max(node.box.contentWidth, 0), { auto: "zero" }),
      right: resolveLength(node.style.borderRight, Math.max(node.box.contentWidth, 0), { auto: "zero" }),
      bottom: resolveLength(node.style.borderBottom, Math.max(node.box.contentWidth, 0), { auto: "zero" }),
      left: resolveLength(node.style.borderLeft, Math.max(node.box.contentWidth, 0), { auto: "zero" }),
    },
    borderRadius,
    opacity: 1,
    overflow: mapOverflow(node.style.overflowX ?? OverflowMode.Visible),
    textRuns,
    decorations: decorations ?? {},
    textShadows: [],
    boxShadows: resolveBoxShadows(node, textColor ?? DEFAULT_TEXT_COLOR),
    establishesStackingContext: false,
    zIndexComputed: 0,
    positioning: mapPosition(node.style),
    children,
    links: [],
    borderColor: parseColor(node.style.borderColor),
    color: textColor,
    background,
    image: imageRef,
  };
}
