import { resolveLength } from "../../css/length.js";
import type { LayoutNode } from "../../dom/node.js";
import type { Rect, Edges } from "../types.js";

export function calculateBoxDimensions(node: LayoutNode): { borderBox: Rect, paddingBox: Rect, contentBox: Rect } {
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
    width: borderBox.width - border.left - border.right,
    height: borderBox.height - border.top - border.bottom,
  };
  const contentBox: Rect = {
    x: paddingBox.x + padding.left,
    y: paddingBox.y + padding.top,
    width: paddingBox.width - padding.left - padding.right,
    height: paddingBox.height - padding.top - padding.bottom,
  };

  return { borderBox, paddingBox, contentBox };
}

export function fallbackDimension(value: number, computed: number): number {
  return value > 0 ? value : computed;
}
