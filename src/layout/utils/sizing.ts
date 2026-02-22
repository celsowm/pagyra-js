import { LayoutNode } from "../../dom/node.js";
import { resolveLength } from "../../css/length.js";

export function shrinkToFitWidth(node: LayoutNode, availableWidth: number): number {
  const containerRefs = { containerWidth: availableWidth, containerHeight: availableWidth };
  if (typeof node.style.width === "number") {
    return Math.min(node.style.width, availableWidth);
  }
  if (node.style.width !== "auto") {
    return Math.min(resolveLength(node.style.width, availableWidth, { ...containerRefs }), availableWidth);
  }
  return availableWidth;
}
