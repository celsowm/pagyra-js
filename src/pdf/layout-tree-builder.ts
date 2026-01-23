import { FloatMode, OverflowMode, Position } from "../css/enums.js";
import type { ComputedStyle } from "../css/style.js";
import { LayoutNode } from "../dom/node.js";
import { resolveLength } from "../css/length.js";
import { log } from "../logging/debug.js";
import {
  type LayoutTree,
  type RenderBox,
  type HeaderFooterHTML,
  type StyleSheets,
  type Positioning,
  type RGBA,
  type BorderStyles,
  type Background,
  NodeKind,
  Overflow,
  LayerMode,
} from "./types.js";
import { parseColor } from "./utils/color-utils.js";
import { resolveTextAlign } from "./utils/text-alignment-resolver.js";
import { resolveBorderRadius } from "./utils/border-radius-utils.js";
import { resolveBoxShadows, resolveTextShadows, calculateVisualOverflow } from "./utils/shadow-utils.js";
import { extractImageRef } from "./utils/image-utils.js";
import { calculateBoxDimensions } from "./utils/box-dimensions-utils.js";
import { resolveDecorations } from "./utils/text-decoration-utils.js";
import {
  resolveBackgroundLayers,
  resolveTextGradientLayer,
} from "./utils/background-layer-resolver.js";
import { resolveClipPath } from "./utils/clip-path-resolver.js";
import { parseTransform } from "../transform/css-parser.js";
import { buildNodeTextRuns } from "./utils/node-text-run-factory.js";
import type { FontResolver } from "../fonts/types.js";

export interface RenderTreeOptions {
  dpiAssumption?: number;
  stylesheets?: Partial<StyleSheets>;
  headerFooter?: Partial<HeaderFooterHTML>;
  fontResolver?: FontResolver;
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

  const state = { counter: 0, fontResolver: options.fontResolver };
  const renderRoot = convertNode(root, state);
  return {
    root: renderRoot,
    dpiAssumption,
    css: stylesheets,
    hf: headerFooter,
  };
}

const DEFAULT_TEXT_COLOR: RGBA = { r: 0, g: 0, b: 0, a: 1 };

function mapNodeKind(node: LayoutNode): NodeKind {
  if (node.tagName === "img") {
    return NodeKind.Image;
  }
  if (node.tagName === "svg" && node.customData && "svg" in node.customData) {
    return NodeKind.Svg;
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
// MAIN CONVERSION FUNCTION
// ====================

function convertNode(
  node: LayoutNode,
  state: { counter: number; fontResolver?: FontResolver },
  inheritedTextGradient?: Background["gradient"],
): RenderBox {
  // Use the original HTML ID if available, otherwise generate a new one
  const originalId = node.customData?.id as string | undefined;
  const id = originalId || `node-${state.counter++}`;
  const { borderBox, paddingBox, contentBox } = calculateBoxDimensions(node);
  const textColor = parseColor(node.style.color);
  const fallbackShadowColor = textColor ?? DEFAULT_TEXT_COLOR;
  const boxShadows = resolveBoxShadows(node, fallbackShadowColor);
  const visualOverflow = calculateVisualOverflow(node, borderBox, boxShadows);
  const borderRadius = resolveBorderRadius(node.style, borderBox);

  const transformString = node.style.transform;
  const transform = transformString ? parseTransform(transformString) ?? undefined : undefined;

  const ownTextGradient = resolveTextGradientLayer(node, { borderBox, paddingBox, contentBox });
  if (ownTextGradient) {
    log("layout", "debug", "node has background-clip:text gradient", {
      tagName: node.tagName,
      rect: ownTextGradient.rect,
    });
  }
  const textGradient = ownTextGradient ?? inheritedTextGradient;

  const children = node.children.map((child) => convertNode(child, state, textGradient));
  const imageRef = extractImageRef(node);
  const decorations = resolveDecorations(node.style);
  const textRuns = buildNodeTextRuns({
    node,
    children,
    borderBox,
    contentBox,
    textColor,
    decorations,
    transform: transform ?? undefined,
    fallbackColor: textColor ?? DEFAULT_TEXT_COLOR,
    fontResolver: state.fontResolver,
    textGradient,
  });

  log("layout", "debug", "node converted", {
    tagName: node.tagName,
    textContent: node.textContent?.slice(0, 40),
    fontFamily: node.style.fontFamily,
    fontSize: node.style.fontSize,
    contentBox,
  });

  const background = resolveBackgroundLayers(node, { borderBox, paddingBox, contentBox });
  const clipPath = resolveClipPath(node, { borderBox, paddingBox, contentBox });

  const zIndex = typeof node.style.zIndex === "number" ? node.style.zIndex : 0;
  const establishesStackingContext =
    typeof node.style.zIndex === "number" && node.style.position !== Position.Static;

  const borderStyle: BorderStyles = {
    top: normalizeBorderStyle(node.style.borderStyleTop),
    right: normalizeBorderStyle(node.style.borderStyleRight),
    bottom: normalizeBorderStyle(node.style.borderStyleBottom),
    left: normalizeBorderStyle(node.style.borderStyleLeft),
  };

  const rawTextAlign = resolveTextAlign(node);
  const textAlign =
    rawTextAlign === "left" ||
      rawTextAlign === "center" ||
      rawTextAlign === "right" ||
      rawTextAlign === "justify"
      ? (rawTextAlign as "left" | "center" | "right" | "justify")
      : undefined;

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
    opacity: node.style.opacity ?? 1,
    overflow: mapOverflow(node.style.overflowX ?? OverflowMode.Visible),
    textRuns,
    decorations: decorations ?? {},
    textShadows: resolveTextShadows(node, fallbackShadowColor),
    boxShadows: resolveBoxShadows(node, textColor ?? DEFAULT_TEXT_COLOR),
    establishesStackingContext,
    zIndexComputed: zIndex,
    positioning: mapPosition(node.style),
    children,
    links: [],
    borderColor: parseColor(node.style.borderColor),
    borderStyle,
    color: textColor,
    background,
    clipPath,
    image: imageRef,
    customData: node.customData ? { ...node.customData } : undefined,
    textAlign,
    transform,
  };
}

function normalizeBorderStyle(value: string | undefined): "none" | "solid" | "dashed" | "dotted" | "double" {
  if (!value) {
    return "solid";
  }
  const keyword = value.toLowerCase();
  if (keyword === "dashed" || keyword === "dotted" || keyword === "double") {
    return keyword;
  }
  if (keyword === "none" || keyword === "hidden") {
    return "none";
  }
  return "solid";
}
