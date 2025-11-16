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
  return {
    gradient: layer.gradient,
    rect: {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
    },
    repeat: layer.repeat ?? "no-repeat",
    originRect,
  };
}

function selectBackgroundOriginRect(
  layer: { origin?: "border-box" | "padding-box" | "content-box" },
  boxes: BackgroundBoxes,
): Rect {
  switch (layer.origin) {
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
