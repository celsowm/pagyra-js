import { FloatMode, OverflowMode, Position } from "../css/enums.js";
import type { ComputedStyle } from "../css/style.js";
import { LayoutNode } from "../dom/node.js";
import { resolveLength } from "../css/length.js";
import { log, preview } from "../debug/log.js";
import { auditRuns } from "../debug/audit.js";
import { normalizeAndSegment } from "../text/text.js";
import {
  type LayoutTree,
  type RenderBox,
  type Rect,
  type Edges,
  type Radius,
  type HeaderFooterHTML,
  type StyleSheets,
  type Positioning,
  type RGBA,
  type Run,
  type ImageRef,
  type Decorations,
  type ShadowLayer,
  NodeKind,
  Overflow,
  LayerMode,
} from "./types.js";
import { resolvedLineHeight } from "../css/style.js";
import { estimateLineWidth } from "../layout/utils/text-metrics.js";
import type { ImageInfo } from "../image/types.js";
import { NAMED_COLORS } from "../css/named-colors.js";

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

function resolveTextAlign(node: LayoutNode): string | undefined {
  let current: LayoutNode | null = node;
  while (current) {
    const value = current.style.textAlign;
    if (value && value !== "start" && value !== "auto") {
      return value;
    }
    current = current.parent;
  }
  return undefined;
}

function convertNode(node: LayoutNode, state: { counter: number }): RenderBox {
  const id = `node-${state.counter++}`;
  const widthRef = Math.max(node.box.contentWidth, 0);
  const contentHeightRef = Math.max(node.box.contentHeight, 0);
  const padding: Edges = {
    top: resolveLength(node.style.paddingTop, widthRef, { auto: "zero" }),
    right: resolveLength(node.style.paddingRight, widthRef, { auto: "zero" }),
    bottom: resolveLength(node.style.paddingBottom, widthRef, { auto: "zero" }),
    left: resolveLength(node.style.paddingLeft, widthRef, { auto: "zero" }),
  };
  const border: Edges = {
    top: resolveLength(node.style.borderTop, widthRef, { auto: "zero" }),
    right: resolveLength(node.style.borderRight, widthRef, { auto: "zero" }),
    bottom: resolveLength(node.style.borderBottom, widthRef, { auto: "zero" }),
    left: resolveLength(node.style.borderLeft, widthRef, { auto: "zero" }),
  };
  const borderBox: Rect = {
    x: node.box.x,
    y: node.box.y,
    width: fallbackDimension(node.box.borderBoxWidth, node.box.contentWidth + padding.left + padding.right + border.left + border.right),
    height: fallbackDimension(
      node.box.borderBoxHeight,
      contentHeightRef + padding.top + padding.bottom + border.top + border.bottom,
    ),
  };
  const paddingBox: Rect = {
    x: borderBox.x + border.left,
    y: borderBox.y + border.top,
    width: node.box.contentWidth + padding.left + padding.right,
    height: node.box.contentHeight + padding.top + padding.bottom,
  };
  const contentBox: Rect = {
    x: paddingBox.x + padding.left,
    y: paddingBox.y + padding.top,
    width: node.box.contentWidth,
    height: node.box.contentHeight,
  };
  const visualOverflow = cloneRect(borderBox);
  const borderRadius = resolveBorderRadius(node.style, borderBox);

  const children = node.children.map((child) => convertNode(child, state));
  const textColor = parseColor(node.style.color);
  const fallbackShadowColor = textColor ?? DEFAULT_TEXT_COLOR;
  const boxShadows = resolveBoxShadows(node, fallbackShadowColor);
  for (const shadow of boxShadows) {
    if (shadow.inset) {
      continue;
    }
    const shadowRect = computeShadowVisualOverflow(borderBox, shadow);
    if (shadowRect) {
      expandRectToInclude(visualOverflow, shadowRect);
    }
  }
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

  return {
    id,
    tagName: node.tagName,
    textContent: node.textContent,
    kind: mapNodeKind(node),
    contentBox,
    paddingBox,
    borderBox,
    visualOverflow,
    padding,
    border,
    borderRadius,
    opacity: 1,
    overflow: mapOverflow(node.style.overflowX ?? OverflowMode.Visible),
    textRuns,
    decorations: decorations ?? {},
    textShadows: [],
    boxShadows,
    establishesStackingContext: false,
    zIndexComputed: 0,
    positioning: mapPosition(node.style),
    children,
    links: [],
    borderColor: parseColor(node.style.borderColor),
    color: textColor,
    background: { color: parseColor(node.style.backgroundColor) },
    image: imageRef,
  };
}

function extractImageRef(node: LayoutNode): ImageRef | undefined {
  if (node.tagName !== "img") {
    return undefined;
  }
  const payload = node.customData?.image as
    | { originalSrc?: string; resolvedSrc?: string; info?: ImageInfo }
    | undefined;
  if (!payload?.info) {
    return undefined;
  }
  const info = payload.info;
  const src = payload.resolvedSrc ?? payload.originalSrc ?? "";
  return {
    src,
    width: info.width,
    height: info.height,
    format: info.format,
    channels: info.channels,
    bitsPerComponent: info.bitsPerChannel,
    data: info.data,
  };
}

function cloneRect(rect: Rect): Rect {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function resolveBoxShadows(node: LayoutNode, fallbackColor: RGBA): ShadowLayer[] {
  const result: ShadowLayer[] = [];
  const shadows = node.style.boxShadows ?? [];
  for (const shadow of shadows) {
    const color = resolveShadowColor(shadow.color, node.style.color, fallbackColor);
    if (!color) {
      continue;
    }
    result.push({
      inset: shadow.inset,
      offsetX: shadow.offsetX,
      offsetY: shadow.offsetY,
      blur: clampNonNegative(shadow.blurRadius),
      spread: shadow.spreadRadius ?? 0,
      color,
    });
  }
  return result;
}

function resolveShadowColor(specified: string | undefined, styleColor: string | undefined, fallbackColor: RGBA): RGBA | undefined {
  if (!specified || specified.trim().length === 0) {
    return cloneColor(fallbackColor);
  }
  const normalized = specified.trim().toLowerCase();
  if (normalized === "transparent") {
    return undefined;
  }
  if (normalized === "currentcolor") {
    const current = parseColor(styleColor);
    return cloneColor(current ?? fallbackColor);
  }
  const parsed = parseColor(specified);
  if (parsed) {
    return cloneColor(parsed);
  }
  return cloneColor(fallbackColor);
}

function cloneColor(color: RGBA): RGBA {
  return { r: color.r, g: color.g, b: color.b, a: color.a };
}

function computeShadowVisualOverflow(base: Rect, shadow: ShadowLayer): Rect | null {
  const spread = shadow.spread;
  const blur = shadow.blur;
  const baseWidth = Math.max(base.width + spread * 2, 0);
  const baseHeight = Math.max(base.height + spread * 2, 0);
  const baseX = base.x + shadow.offsetX - spread;
  const baseY = base.y + shadow.offsetY - spread;
  const finalWidth = baseWidth + blur * 2;
  const finalHeight = baseHeight + blur * 2;
  if (finalWidth <= 0 || finalHeight <= 0) {
    return null;
  }
  return {
    x: baseX - blur,
    y: baseY - blur,
    width: finalWidth,
    height: finalHeight,
  };
}

function expandRectToInclude(target: Rect, addition: Rect): void {
  if (addition.width <= 0 || addition.height <= 0) {
    return;
  }
  const minX = Math.min(target.x, addition.x);
  const minY = Math.min(target.y, addition.y);
  const maxX = Math.max(target.x + target.width, addition.x + addition.width);
  const maxY = Math.max(target.y + target.height, addition.y + addition.height);
  target.x = minX;
  target.y = minY;
  target.width = Math.max(0, maxX - minX);
  target.height = Math.max(0, maxY - minY);
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value;
}

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

function fallbackDimension(value: number, computed: number): number {
  return value > 0 ? value : computed;
}

function createTextRuns(node: LayoutNode, color: RGBA | undefined, inheritedDecorations?: Decorations): Run[] {
  const runs: Run[] = [];
  const defaultColor = color ?? DEFAULT_TEXT_COLOR;
  const effectiveTextAlign = resolveTextAlign(node) ?? node.style.textAlign;
  const decoration = inheritedDecorations ?? resolveDecorations(node.style);
  const fontFamily = node.style.fontFamily ?? "sans-serif";
  const fontSize = node.style.fontSize;
  const fontWeight = node.style.fontWeight;

  // Se o layout calculou caixas de linha, use-as.
  if (node.lineBoxes && node.lineBoxes.length > 0) {
    const lineHeight = resolvedLineHeight(node.style);
    const contentWidth = Math.max(node.box.contentWidth, 0);
    // Alignment logic
    let alignY = node.box.y;
    // Vertical alignment
    let totalTextHeight = node.lineBoxes.length * lineHeight;
    if (node.style.verticalAlign === "middle") {
      alignY = node.box.y + (node.box.contentHeight - totalTextHeight) / 2;
    } else if (node.style.verticalAlign === "bottom") {
      alignY = node.box.y + (node.box.contentHeight - totalTextHeight);
    }
    const justify = effectiveTextAlign === "justify";
    for (let i = 0; i < node.lineBoxes.length; i++) {
      const line = node.lineBoxes[i];
      const normalizedText = line.text.normalize("NFC");
      const baseWidth = line.width ?? estimateLineWidth(normalizedText, node.style);
      const lineYOffset = i * lineHeight;
      const baseline = alignY + lineYOffset + fontSize;
      let startX = node.box.x;
      if (effectiveTextAlign === "center") {
        startX = node.box.x + Math.max((contentWidth - baseWidth) / 2, 0);
      } else if (effectiveTextAlign === "right") {
        startX = node.box.x + Math.max(contentWidth - baseWidth, 0);
      }
      let wordSpacing: number | undefined;
      if (justify && i < node.lineBoxes.length - 1) {
        const gapCount = line.spaceCount ?? 0;
        if (gapCount > 0) {
          const targetWidth = line.targetWidth ?? contentWidth ?? baseWidth;
          const slack = Math.max(targetWidth - baseWidth, 0);
          if (slack > 0) {
            wordSpacing = slack / gapCount;
          }
        }
      }
      const targetWidth = line.targetWidth ?? baseWidth;
      const advanceWidth =
        wordSpacing !== undefined && wordSpacing !== 0 && targetWidth > 0
          ? Math.max(targetWidth, baseWidth)
          : Math.max(baseWidth, 0);
      runs.push({
        text: normalizedText,
        fontFamily,
        fontSize,
        fontWeight,
        fill: defaultColor,
        lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: startX, f: baseline },
        wordSpacing,
        decorations: decoration ? { ...decoration } : undefined,
        advanceWidth,
      });
    }
    return runs;
  }
  
  // Fallback para o comportamento original se não houver quebra de linha calculada
  if (node.textContent) {
    const raw = node.textContent;
    const normalized = raw.normalize("NFC");
    // Se não houver lineBoxes, a baseline é a calculada para a caixa inteira.
    const baseline = node.box.baseline > 0 ? node.box.baseline : node.box.y + node.box.contentHeight;
    const advanceWidth = Math.max(estimateLineWidth(normalized, node.style), 0);
    const contentWidth = Math.max(node.box.contentWidth, 0);
    let startX = node.box.x;
    if (effectiveTextAlign === "center") {
      startX = node.box.x + Math.max((contentWidth - advanceWidth) / 2, 0);
    } else if (effectiveTextAlign === "right") {
      startX = node.box.x + Math.max(contentWidth - advanceWidth, 0);
    }

    return [{
      text: normalized,
      fontFamily,
      fontSize,
      fontWeight,
      fill: defaultColor,
      lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: startX, f: baseline },
      decorations: decoration ? { ...decoration } : undefined,
      advanceWidth,
    }];
  }

  return [];
}

function createListMarkerRun(
  node: LayoutNode,
  contentBox: Rect,
  children: RenderBox[],
  fallbackColor: RGBA,
): Run | undefined {
  const styleType = resolveListStyleType(node);
  if (!styleType || styleType === "none") {
    return undefined;
  }
  const markerIndex = computeListItemIndex(node);
  const markerText = formatListMarker(styleType, markerIndex);
  if (!markerText) {
    return undefined;
  }

  const firstRun = findFirstDescendantTextRun(children);
  const fontFamily = node.style.fontFamily ?? "sans-serif";
  const fontSize = node.style.fontSize;
  const fontWeight = node.style.fontWeight;
  const color = fallbackColor ?? DEFAULT_TEXT_COLOR;

  const baseline =
    firstRun?.lineMatrix.f ??
    (node.box.baseline > 0 ? node.box.baseline : contentBox.y + fontSize);
  const textStartX = firstRun?.lineMatrix.e ?? contentBox.x;
  const markerWidth = Math.max(estimateLineWidth(markerText, node.style), 0);
  const gap = Math.max(fontSize * 0.5, 6);
  const markerX = textStartX - gap - markerWidth;

  return {
    text: markerText,
    fontFamily,
    fontSize,
    fontWeight,
    fill: color,
    lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: markerX, f: baseline },
    advanceWidth: markerWidth + gap,
  };
}

function findFirstDescendantTextRun(children: RenderBox[]): Run | undefined {
  for (const child of children) {
    if (child.textRuns.length > 0) {
      return child.textRuns[0];
    }
    const nested = findFirstDescendantTextRun(child.children);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

function computeListItemIndex(node: LayoutNode): number {
  const parent = node.parent;
  if (!parent) {
    return 1;
  }
  let index = 0;
  for (const sibling of parent.children) {
    if (sibling.tagName === "li") {
      index += 1;
    }
    if (sibling === node) {
      break;
    }
  }
  return Math.max(index, 1);
}

function formatListMarker(styleType: string, index: number): string | undefined {
  const normalized = styleType.trim().toLowerCase();
  switch (normalized) {
    case "none":
      return undefined;
    case "decimal":
      return `${index}.`;
    case "decimal-leading-zero":
      return `${String(index).padStart(2, "0")}.`;
    case "disc":
      return "•";
    case "circle":
      return "○";
    case "square":
      return "▪";
    default:
      return "•";
  }
}

function resolveListStyleType(node: LayoutNode): string | undefined {
  const own = normalizeListStyleType(node.style.listStyleType);
  if (own === "none") {
    return "none";
  }
  if (own && own !== "disc") {
    return own;
  }

  const parent = node.parent;
  if (parent) {
    const parentStyle = normalizeListStyleType(parent.style.listStyleType);
    if (parentStyle === "none") {
      return "none";
    }
    if (parentStyle) {
      return parentStyle;
    }
    if (parent.tagName === "ol") {
      return "decimal";
    }
    if (parent.tagName === "ul") {
      return "disc";
    }
  }

  return own ?? "disc";
}

function normalizeListStyleType(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveDecorations(style: ComputedStyle): Decorations | undefined {
  const value = style.textDecorationLine?.trim().toLowerCase();
  if (!value || value === "none") {
    return undefined;
  }
  const tokens = value.split(/\s+/);
  const decoration: Decorations = {};
  for (const token of tokens) {
    switch (token) {
      case "underline":
        decoration.underline = true;
        break;
      case "overline":
        decoration.overline = true;
        break;
      case "line-through":
        decoration.lineThrough = true;
        break;
      default:
        break;
    }
  }
  return decoration.underline || decoration.overline || decoration.lineThrough ? decoration : undefined;
}

function groupByFace(text: string, fontFamily: string, color: RGBA, baseline: number, fontSize: number): Run[] {
  // Simplified implementation - in a full system this would resolve glyph fonts
  // For now, we create single runs to maintain compatibility
  return [{
    text,
    fontFamily,
    fontSize,
    fontWeight: undefined,
    fill: color,
    lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: baseline },
  }];
}

function resolveBorderRadius(style: ComputedStyle, borderBox: Rect): Radius {
  const raw: Radius = {
    topLeft: {
      x: clampRadius(style.borderTopLeftRadiusX),
      y: clampRadius(style.borderTopLeftRadiusY),
    },
    topRight: {
      x: clampRadius(style.borderTopRightRadiusX),
      y: clampRadius(style.borderTopRightRadiusY),
    },
    bottomRight: {
      x: clampRadius(style.borderBottomRightRadiusX),
      y: clampRadius(style.borderBottomRightRadiusY),
    },
    bottomLeft: {
      x: clampRadius(style.borderBottomLeftRadiusX),
      y: clampRadius(style.borderBottomLeftRadiusY),
    },
  };
  return normalizeBorderRadius(raw, borderBox.width, borderBox.height);
}

function clampRadius(value: number | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 0;
  }
  const numeric = Number(value);
  return numeric > 0 ? numeric : 0;
}

function normalizeBorderRadius(input: Radius, width: number, height: number): Radius {
  const result: Radius = {
    topLeft: { ...input.topLeft },
    topRight: { ...input.topRight },
    bottomRight: { ...input.bottomRight },
    bottomLeft: { ...input.bottomLeft },
  };

  const safeWidth = Math.max(width, 0);
  const safeHeight = Math.max(height, 0);

  if (safeWidth <= 0) {
    result.topLeft.x = 0;
    result.topRight.x = 0;
    result.bottomRight.x = 0;
    result.bottomLeft.x = 0;
  } else {
    const topSum = result.topLeft.x + result.topRight.x;
    if (topSum > safeWidth && topSum > 0) {
      const scale = safeWidth / topSum;
      result.topLeft.x *= scale;
      result.topRight.x *= scale;
    }
    const bottomSum = result.bottomLeft.x + result.bottomRight.x;
    if (bottomSum > safeWidth && bottomSum > 0) {
      const scale = safeWidth / bottomSum;
      result.bottomLeft.x *= scale;
      result.bottomRight.x *= scale;
    }
  }

  if (safeHeight <= 0) {
    result.topLeft.y = 0;
    result.topRight.y = 0;
    result.bottomRight.y = 0;
    result.bottomLeft.y = 0;
  } else {
    const leftSum = result.topLeft.y + result.bottomLeft.y;
    if (leftSum > safeHeight && leftSum > 0) {
      const scale = safeHeight / leftSum;
      result.topLeft.y *= scale;
      result.bottomLeft.y *= scale;
    }
    const rightSum = result.topRight.y + result.bottomRight.y;
    if (rightSum > safeHeight && rightSum > 0) {
      const scale = safeHeight / rightSum;
      result.topRight.y *= scale;
      result.bottomRight.y *= scale;
    }
  }

  return result;
}

function parseColor(value: string | undefined): RGBA | undefined {
  if (!value) {
    return undefined;
  }

  let normalized = value.trim().toLowerCase();
  if (normalized in NAMED_COLORS) {
    normalized = NAMED_COLORS[normalized];
  }

  if (normalized === "transparent") {
    return undefined;
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const digits = hexMatch[1];
    if (digits.length === 3) {
      const r = parseHex(digits[0] + digits[0]);
      const g = parseHex(digits[1] + digits[1]);
      const b = parseHex(digits[2] + digits[2]);
      return { r, g, b, a: 1 };
    }
    const r = parseHex(digits.slice(0, 2));
    const g = parseHex(digits.slice(2, 4));
    const b = parseHex(digits.slice(4, 6));
    return { r, g, b, a: 1 };
  }
  const rgbMatch = normalized.match(/^rgba?\((.+)\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((part) => part.trim());
    const r = clampColor(Number.parseFloat(parts[0]));
    const g = clampColor(Number.parseFloat(parts[1]));
    const b = clampColor(Number.parseFloat(parts[2]));
    const a = parts[3] !== undefined ? clampAlpha(Number.parseFloat(parts[3])) : 1;
    return { r, g, b, a };
  }
  return undefined;
}

function parseHex(value: string): number {
  return Number.parseInt(value, 16);
}

function clampColor(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value > 255) {
    return 255;
  }
  if (value < 0) {
    return 0;
  }
  return value;
}

function clampAlpha(value: number): number {
  if (Number.isNaN(value)) {
    return 1;
  }
  if (value > 1) {
    return 1;
  }
  if (value < 0) {
    return 0;
  }
  return value;
}
