import type { LayoutNode } from "../../dom/node.js";
import type { Rect, Background, ImageRef } from "../types.js";
import { parseColor } from "./color-utils.js";
import type {
  BackgroundPosition,
  BackgroundSize,
  GradientBackgroundLayer,
  ImageBackgroundLayer,
} from "../../css/background-types.js";
import type { ImageInfo } from "../../image/types.js";
import type { RadialGradient } from "../../css/parsers/gradient-parser.js";

export interface BackgroundBoxes {
  borderBox: Rect;
  paddingBox: Rect;
  contentBox: Rect;
}

export function resolveBackgroundLayers(node: LayoutNode, boxes: BackgroundBoxes): Background {
  const layers = node.style.backgroundLayers ?? [];
  const background: Background = {};

  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.clip === "text") {
      continue;
    }

    if (layer.kind === "gradient" && background.gradient === undefined) {
      const gradient = createGradientBackground(layer, boxes);
      if (gradient) {
        background.gradient = gradient;
      }
    } else if (layer.kind === "image" && background.image === undefined) {
      const image = createBackgroundImage(layer, boxes);
      if (image) {
        background.image = image;
      }
    }
  }

  const color = parseColor(node.style.backgroundColor || undefined);
  if (color) {
    background.color = color;
  }

  return background;
}

export function resolveTextGradientLayer(node: LayoutNode, boxes: BackgroundBoxes): Background["gradient"] | undefined {
  const layers = node.style.backgroundLayers ?? [];
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.kind === "gradient" && layer.clip === "text") {
      const gradient = createGradientBackground(layer, boxes);
      if (gradient) {
        return gradient;
      }
    }
  }
  return undefined;
}

function createBackgroundImage(layer: ImageBackgroundLayer, boxes: BackgroundBoxes): Background["image"] | undefined {
  if (!layer.imageInfo) {
    return undefined;
  }
  const originRect = selectBackgroundOriginRect(layer, boxes);
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

function createGradientBackground(
  layer: GradientBackgroundLayer,
  boxes: BackgroundBoxes,
): Background["gradient"] | undefined {
  const originRect = selectBackgroundOriginRect(layer, boxes);
  const size = resolveGradientSize(layer.size, originRect);
  if (size.width <= 0 || size.height <= 0) {
    return undefined;
  }
  const position = resolveBackgroundPosition(layer.position, originRect, size.width, size.height);
  const rect = {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  };

  const normalizedGradient = normalizeGradientGeometry(layer.gradient, rect);
  if (!normalizedGradient) {
    return undefined;
  }
  return {
    gradient: normalizedGradient,
    rect,
    repeat: layer.repeat ?? "no-repeat",
    originRect,
  };
}

function selectBackgroundOriginRect(
  layer: { origin?: "border-box" | "padding-box" | "content-box" },
  boxes: BackgroundBoxes,
): Rect {
  switch (layer.origin) {
    case "border-box":
      return boxes.borderBox;
    case "padding-box":
      return boxes.paddingBox;
    case "content-box":
      return boxes.contentBox;
    default:
      return boxes.paddingBox;
  }
}

function resolveBackgroundImageSize(size: BackgroundSize | undefined, area: Rect, info: ImageInfo): {
  width: number;
  height: number;
} {
  const intrinsicWidth = info.width;
  const intrinsicHeight = info.height;
  const areaWidth = area.width;
  const areaHeight = area.height;
  const ratio = intrinsicWidth > 0 && intrinsicHeight > 0 ? intrinsicWidth / intrinsicHeight : 1;

  if (!size || typeof size === "string") {
    if (size === "cover") {
      if (ratio >= areaWidth / areaHeight) {
        return { width: ratio * areaHeight, height: areaHeight };
      }
      return { width: areaWidth, height: areaWidth / ratio };
    }
    if (size === "contain") {
      if (ratio >= areaWidth / areaHeight) {
        return { width: areaWidth, height: areaWidth / ratio };
      }
      return { width: ratio * areaHeight, height: areaHeight };
    }
    if (intrinsicWidth > 0 && intrinsicHeight > 0) {
      return { width: intrinsicWidth, height: intrinsicHeight };
    }
    return { width: areaWidth, height: areaHeight };
  }

  const widthComponent =
    parseBackgroundSizeComponent(size.width, areaWidth, intrinsicWidth) ?? parseBackgroundSizeComponent("auto", areaWidth, intrinsicWidth);
  const heightComponent =
    parseBackgroundSizeComponent(size.height, areaHeight, intrinsicHeight) ?? parseBackgroundSizeComponent("auto", areaHeight, intrinsicHeight);

  return { width: widthComponent ?? areaWidth, height: heightComponent ?? areaHeight };
}

function resolveGradientSize(size: BackgroundSize | undefined, area: Rect): { width: number; height: number } {
  if (!size || typeof size === "string") {
    return { width: area.width, height: area.height };
  }

  const resolvedWidth = parseBackgroundSizeComponent(size.width, area.width, area.width) ?? area.width;
  const resolvedHeight = parseBackgroundSizeComponent(size.height, area.height, area.height) ?? area.height;

  return { width: resolvedWidth, height: resolvedHeight };
}

function resolveBackgroundPosition(
  position: BackgroundPosition | undefined,
  area: Rect,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = resolvePositionComponent(position?.x, area.x, area.width - width, width, "x");
  const y = resolvePositionComponent(position?.y, area.y, area.height - height, height, "y");
  return { x, y };
}

function resolvePositionComponent(
  value: string | undefined,
  start: number,
  available: number,
  size: number,
  axis: "x" | "y",
): number {
  if (!value || value === "left" || value === "top") {
    return start;
  }
  if (value === "center") {
    return start + available / 2;
  }
  if (value === "right" || value === "bottom") {
    return start + available;
  }
  if (value.endsWith("%")) {
    const percent = parseFloat(value);
    if (!Number.isNaN(percent)) {
      return start + (percent / 100) * available;
    }
  }
  if (value.endsWith("px")) {
    const px = parseFloat(value);
    if (!Number.isNaN(px)) {
      return start + px;
    }
  }
  return axis === "x" ? start : start + available;
}

function parseBackgroundSizeComponent(
  component: string | undefined,
  axisLength: number,
  intrinsic: number,
): number | undefined {
  if (!component || component === "auto") {
    return intrinsic > 0 ? intrinsic : undefined;
  }
  if (component.endsWith("%")) {
    const percent = parseFloat(component);
    if (!Number.isNaN(percent)) {
      return (percent / 100) * axisLength;
    }
    return undefined;
  }
  if (component.endsWith("px")) {
    const px = parseFloat(component);
    if (!Number.isNaN(px)) {
      return px;
    }
    return undefined;
  }
  const value = Number(component);
  if (Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function normalizeGradientGeometry(
  gradient: GradientBackgroundLayer["gradient"],
  rect: Rect,
): GradientBackgroundLayer["gradient"] | undefined {
  if (!gradient) {
    return undefined;
  }
  if ((gradient as any).type === "radial") {
    return normalizeRadialGradient(gradient as RadialGradient, rect);
  }
  return gradient;
}

function normalizeRadialGradient(
  gradient: RadialGradient,
  rect: Rect,
): RadialGradient | undefined {
  if (gradient.coordsUnits === "userSpace") {
    return gradient;
  }
  if (rect.width <= 0 || rect.height <= 0) {
    return undefined;
  }

  const hasCssHints = !!gradient.at || !!gradient.size || !!gradient.shape || gradient.source === "css";
  if (!hasCssHints) {
    return gradient;
  }

  const cxPx = resolvePositionToPx(gradient.at?.x, rect.width, (gradient.cx ?? 0.5) * rect.width, "x");
  const cyPx = resolvePositionToPx(gradient.at?.y, rect.height, (gradient.cy ?? 0.5) * rect.height, "y");
  const radiusPx = resolveRadialRadiusPx(
    gradient.size,
    gradient.shape,
    rect.width,
    rect.height,
    cxPx,
    cyPx,
    gradient.r,
  );
  const maxDimension = Math.max(rect.width, rect.height, 1);

  return {
    ...gradient,
    cx: clampUnit(cxPx / rect.width),
    cy: clampUnit(cyPx / rect.height),
    r: clampUnit(radiusPx / maxDimension),
    coordsUnits: "ratio",
  };
}

function resolvePositionToPx(
  raw: string | undefined,
  length: number,
  fallbackPx: number,
  axis: "x" | "y",
): number {
  if (!Number.isFinite(length) || length <= 0) {
    return fallbackPx;
  }
  if (!raw) {
    return clamp(rawNumber(fallbackPx), 0, length);
  }
  const lower = raw.trim().toLowerCase();
  if (lower === "left" || lower === "top") return 0;
  if (lower === "center") return length / 2;
  if (lower === "right" || lower === "bottom") return length;
  if (lower.endsWith("%")) {
    const pct = Number.parseFloat(lower.slice(0, -1));
    if (Number.isFinite(pct)) {
      return clamp((pct / 100) * length, 0, length);
    }
  }
  if (lower.endsWith("px")) {
    const px = Number.parseFloat(lower);
    if (Number.isFinite(px)) {
      return clamp(px, 0, length);
    }
  }
  const numeric = Number.parseFloat(lower);
  if (Number.isFinite(numeric)) {
    return clamp(numeric, 0, length);
  }
  return clamp(rawNumber(fallbackPx), 0, length);
}

function resolveRadialRadiusPx(
  size: RadialGradient["size"],
  shape: RadialGradient["shape"],
  width: number,
  height: number,
  cx: number,
  cy: number,
  fallbackRatio: number,
): number {
  const distanceLeft = Math.max(cx, 0);
  const distanceRight = Math.max(width - cx, 0);
  const distanceTop = Math.max(cy, 0);
  const distanceBottom = Math.max(height - cy, 0);

  const sideMin = Math.min(distanceLeft, distanceRight, distanceTop, distanceBottom);
  const sideMax = Math.max(distanceLeft, distanceRight, distanceTop, distanceBottom);

  const cornerDistances = [
    Math.hypot(cx, cy),
    Math.hypot(cx, Math.max(height - cy, 0)),
    Math.hypot(Math.max(width - cx, 0), cy),
    Math.hypot(Math.max(width - cx, 0), Math.max(height - cy, 0)),
  ];
  const cornerMin = Math.min(...cornerDistances);
  const cornerMax = Math.max(...cornerDistances);

  const keyword = typeof size === "string" ? size.toLowerCase() : undefined;
  if (keyword === "closest-side") {
    return sideMin;
  }
  if (keyword === "farthest-side") {
    return sideMax;
  }
  if (keyword === "closest-corner") {
    return cornerMin;
  }
  if (keyword === "farthest-corner" || keyword === undefined) {
    return cornerMax;
  }

  const explicit = parseLength(size, Math.max(width, height));
  if (explicit !== undefined) {
    return explicit;
  }

  const fallback = Number.isFinite(fallbackRatio) ? fallbackRatio * Math.max(width, height) : cornerMax;
  return fallback;
}

function parseLength(value: string | undefined, relativeTo: number): number | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed.endsWith("%")) {
    const pct = Number.parseFloat(trimmed.slice(0, -1));
    if (Number.isFinite(pct)) {
      return (pct / 100) * relativeTo;
    }
    return undefined;
  }
  if (trimmed.endsWith("px")) {
    const px = Number.parseFloat(trimmed);
    return Number.isFinite(px) ? px : undefined;
  }
  const numeric = Number.parseFloat(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function rawNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
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
