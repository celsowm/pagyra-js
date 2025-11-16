import { Display, JustifyContent } from "../../css/enums.js";
import type { LayoutNode } from "../../dom/node.js";

export function resolveTextAlign(node: LayoutNode): string | undefined {
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

export function resolveFallbackStartX(node: LayoutNode, advanceWidth: number, textAlign?: string): number {
  let startX = node.box.x;
  if (advanceWidth > 0 && Number.isFinite(node.box.contentWidth) && node.box.contentWidth > 0) {
    const slack = Math.max(node.box.contentWidth - advanceWidth, 0);
    if (textAlign === "center") {
      startX = node.box.x + slack / 2;
    } else if (textAlign === "right" || textAlign === "end") {
      startX = node.box.x + slack;
    } else if (textAlign === "left" || textAlign === "start") {
      startX = node.box.x;
    }
  }

  const flexStart = resolveFlexSingleChildStart(node, advanceWidth);
  if (flexStart !== null) {
    startX = flexStart;
  }
  return startX;
}

export function resolveFlexSingleChildStart(node: LayoutNode, advanceWidth: number): number | null {
  if (!node.parent || advanceWidth <= 0) {
    return null;
  }
  const parent = node.parent;
  if (parent.style.display !== Display.Flex) {
    return null;
  }
  if (parent.children.length !== 1) {
    return null;
  }
  const direction = parent.style.flexDirection ?? "row";
  if (direction !== "row" && direction !== "row-reverse") {
    return null;
  }
  const justify = parent.style.justifyContent ?? JustifyContent.FlexStart;
  const parentWidth = Number.isFinite(parent.box.contentWidth) ? parent.box.contentWidth : 0;
  if (!(parentWidth > 0)) {
    return null;
  }
  const constrainedWidth = advanceWidth > parentWidth ? parentWidth : advanceWidth;
  const slack = Math.max(parentWidth - constrainedWidth, 0);
  const parentStart = parent.box.x;
  const parentEnd = parentStart + parentWidth;
  const isReverse = direction === "row-reverse";

  switch (justify) {
    case JustifyContent.Center:
      return parentStart + slack / 2;
    case JustifyContent.FlexEnd:
    case JustifyContent.End:
    case JustifyContent.Right:
      return isReverse ? parentStart : parentEnd - constrainedWidth;
    case JustifyContent.FlexStart:
    case JustifyContent.Start:
    case JustifyContent.Left:
      return isReverse ? parentEnd - constrainedWidth : parentStart;
    default:
      return null;
  }
}
