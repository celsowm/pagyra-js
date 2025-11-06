import { FloatMode, OverflowMode, Position } from "../css/enums.js";
import type { ComputedStyle } from "../css/style.js";
import { LayoutNode } from "../dom/node.js";
import { resolveLength } from "../css/length.js";
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
  type ImageRef,
  type Background,
  type BackgroundImage,
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
import type { ImageBackgroundLayer, BackgroundSize, BackgroundPosition } from "../css/background-types.js";
import type { ImageInfo } from "../image/types.js";

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
// BACKGROUND HANDLING
// ====================

function selectBackgroundOriginRect(
  layer: ImageBackgroundLayer,
  borderBox: Rect,
  paddingBox: Rect,
  contentBox: Rect,
): Rect {
  const origin = layer.origin ?? "padding-box";
  switch (origin) {
    case "border-box":
      return { ...borderBox };
    case "content-box":
      return { ...contentBox };
    default:
      return { ...paddingBox };
  }
}

function parseBackgroundSizeComponent(component: string | undefined, axisLength: number, intrinsic: number): number | undefined {
  if (!component) {
    return undefined;
  }
  const normalized = component.trim().toLowerCase();
  if (!normalized || normalized === "auto") {
    return undefined;
  }
  if (normalized.endsWith("%")) {
    const value = Number.parseFloat(normalized.slice(0, -1));
    if (Number.isFinite(value)) {
      return (axisLength * value) / 100;
    }
    return undefined;
  }
  if (normalized.endsWith("px")) {
    const value = Number.parseFloat(normalized.slice(0, -2));
    return Number.isFinite(value) ? value : undefined;
  }
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : intrinsic;
}

function resolveBackgroundImageSize(size: BackgroundSize | undefined, area: Rect, info: ImageInfo): { width: number; height: number } {
  const intrinsicWidth = info.width;
  const intrinsicHeight = info.height;
  if (!size || size === "auto") {
    return { width: intrinsicWidth, height: intrinsicHeight };
  }
  if (size === "cover") {
    const scale = Math.max(
      area.width > 0 && intrinsicWidth > 0 ? area.width / intrinsicWidth : 0,
      area.height > 0 && intrinsicHeight > 0 ? area.height / intrinsicHeight : 0,
    );
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    return {
      width: intrinsicWidth * safeScale,
      height: intrinsicHeight * safeScale,
    };
  }
  if (size === "contain") {
    const scale = Math.min(
      area.width > 0 && intrinsicWidth > 0 ? area.width / intrinsicWidth : Number.POSITIVE_INFINITY,
      area.height > 0 && intrinsicHeight > 0 ? area.height / intrinsicHeight : Number.POSITIVE_INFINITY,
    );
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    return {
      width: intrinsicWidth * safeScale,
      height: intrinsicHeight * safeScale,
    };
  }
  const widthComponent = parseBackgroundSizeComponent(size.width, area.width, intrinsicWidth);
  const heightComponent = parseBackgroundSizeComponent(size.height, area.height, intrinsicHeight);

  let width = widthComponent ?? intrinsicWidth;
  let height = heightComponent ?? intrinsicHeight;

  if (widthComponent !== undefined && heightComponent === undefined && intrinsicWidth > 0) {
    const scale = widthComponent / intrinsicWidth;
    height = intrinsicHeight * scale;
  } else if (heightComponent !== undefined && widthComponent === undefined && intrinsicHeight > 0) {
    const scale = heightComponent / intrinsicHeight;
    width = intrinsicWidth * scale;
  }

  return {
    width,
    height,
  };
}

function resolvePositionComponent(value: string, start: number, available: number, size: number, axis: "x" | "y"): number {
  const keyword = value.toLowerCase();
  if (keyword === "center") {
    return start + (available - size) / 2;
  }
  if (axis === "x") {
    if (keyword === "right") {
      return start + (available - size);
    }
    if (keyword === "left") {
      return start;
    }
  } else {
    if (keyword === "bottom") {
      return start + (available - size);
    }
    if (keyword === "top") {
      return start;
    }
  }
  if (keyword.endsWith("%")) {
    const valuePct = Number.parseFloat(keyword.slice(0, -1));
    if (Number.isFinite(valuePct)) {
      return start + ((available - size) * valuePct) / 100;
    }
  }
  const numeric = Number.parseFloat(keyword);
  if (Number.isFinite(numeric)) {
    return start + numeric;
  }
  return start;
}

function resolveBackgroundPosition(
  position: BackgroundPosition | undefined,
  area: Rect,
  width: number,
  height: number,
): { x: number; y: number } {
  const posX = position?.x ?? "left";
  const posY = position?.y ?? "top";
  const x = resolvePositionComponent(posX, area.x, area.width, width, "x");
  const y = resolvePositionComponent(posY, area.y, area.height, height, "y");
  return { x, y };
}

function convertToImageRef(layer: ImageBackgroundLayer, info: ImageInfo): ImageRef {
  return {
    src: layer.resolvedUrl ?? layer.originalUrl ?? "",
    width: info.width,
    height: info.height,
    format: info.format,
    channels: info.channels,
    bitsPerComponent: info.bitsPerChannel,
    data: info.data,
  };
}

function createBackgroundImage(
  layer: ImageBackgroundLayer,
  borderBox: Rect,
  paddingBox: Rect,
  contentBox: Rect,
): BackgroundImage | undefined {
  if (!layer.imageInfo) {
    return undefined;
  }
  const originRect = selectBackgroundOriginRect(layer, borderBox, paddingBox, contentBox);
  const size = resolveBackgroundImageSize(layer.size, originRect, layer.imageInfo);
  if (size.width <= 0 || size.height <= 0) {
    return undefined;
  }
  const position = resolveBackgroundPosition(layer.position, originRect, size.width, size.height);
  const imageRef = convertToImageRef(layer, layer.imageInfo);
  return {
    image: imageRef,
    rect: {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
    },
    repeat: layer.repeat ?? "repeat",
    originRect,
  };
}

function handleBackground(
  node: LayoutNode,
  borderBox: Rect,
  paddingBox: Rect,
  contentBox: Rect,
): Background {
  const style = node.style;
  const layers = style.backgroundLayers ?? [];
  const background: Background = {};

  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.kind === "gradient" && background.gradient === undefined) {
      background.gradient = layer.gradient;
    } else if (layer.kind === "image" && background.image === undefined) {
      const image = createBackgroundImage(layer, borderBox, paddingBox, contentBox);
      if (image) {
        background.image = image;
      }
    }
  }

  const color = parseColor(style.backgroundColor || undefined);
  if (color) {
    background.color = color;
  }

  return background;
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

  // Handle background (colors, gradients, images)
  const background = handleBackground(node, borderBox, paddingBox, contentBox);
  
  const zIndex = typeof node.style.zIndex === "number" ? node.style.zIndex : 0;
  const establishesStackingContext =
    typeof node.style.zIndex === "number" && node.style.position !== Position.Static;

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
    establishesStackingContext,
    zIndexComputed: zIndex,
    positioning: mapPosition(node.style),
    children,
    links: [],
    borderColor: parseColor(node.style.borderColor),
    color: textColor,
    background,
    image: imageRef,
    customData: node.customData ? { ...node.customData } : undefined,
  };
}
