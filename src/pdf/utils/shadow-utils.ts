import type { LayoutNode } from "../../dom/node.js";
import type { Rect, ShadowLayer, RGBA } from "../types.js";
import { parseColor, cloneColor } from "./color-utils.js";

export function resolveBoxShadows(node: LayoutNode, fallbackColor: RGBA): ShadowLayer[] {
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

export function resolveTextShadows(node: LayoutNode, fallbackColor: RGBA): ShadowLayer[] {
  const result: ShadowLayer[] = [];
  const shadows = (node.style as any).textShadows ?? [];
  for (const shadow of shadows) {
    // shadow here is expected to have numeric offsetX/offsetY/blurRadius and optional color
    const offsetX = shadow.offsetX ?? 0;
    const offsetY = shadow.offsetY ?? 0;
    const blur = clampNonNegative(shadow.blurRadius ?? 0);
    const color = resolveShadowColor(shadow.color, node.style.color, fallbackColor);
    if (!color) {
      continue;
    }
    result.push({
      inset: false,
      offsetX,
      offsetY,
      blur,
      spread: 0,
      color,
    });
  }
  return result;
}

export function resolveShadowColor(specified: string | undefined, styleColor: string | undefined, fallbackColor: RGBA): RGBA | undefined {
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

export function computeShadowVisualOverflow(base: Rect, shadow: ShadowLayer): Rect | null {
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

export function calculateVisualOverflow(node: LayoutNode, borderBox: Rect, boxShadows: ShadowLayer[]): Rect {
  const visualOverflow = cloneRect(borderBox);
  
  for (const shadow of boxShadows) {
    if (shadow.inset) {
      continue;
    }
    const shadowRect = computeShadowVisualOverflow(borderBox, shadow);
    if (shadowRect) {
      expandRectToInclude(visualOverflow, shadowRect);
    }
  }

  return visualOverflow;
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value;
}

function cloneRect(rect: Rect): Rect {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
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
