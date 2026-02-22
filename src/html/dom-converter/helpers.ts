import type { SvgRootNode } from "../../svg/types.js";
import type { SvgElement } from "../../types/core.js";

export function parseSpan(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function resolveSvgIntrinsicSize(svg: SvgRootNode, element: SvgElement): { width: number; height: number } {
  let width = svg.width;
  let height = svg.height;
  if (svg.viewBox) {
    if (!width || width <= 0) {
      width = svg.viewBox.width;
    }
    if (!height || height <= 0) {
      height = svg.viewBox.height;
    }
  }
  if (!width || width <= 0) {
    width = attributeToNumber(element.getAttribute("width")) ?? 100;
  }
  if (!height || height <= 0) {
    height = attributeToNumber(element.getAttribute("height")) ?? width;
  }
  return {
    width: Number.isFinite(width) && width > 0 ? width : 100,
    height: Number.isFinite(height) && height > 0 ? height : 100,
  };
}

function attributeToNumber(raw: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
}
