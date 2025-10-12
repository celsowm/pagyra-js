import { LayoutNode } from "../../dom/node.js";
import { resolveLength } from "../../css/length.js";

export function shrinkToFitWidth(node: LayoutNode, availableWidth: number): number {
  if (typeof node.style.width === "number") {
    return Math.min(node.style.width, availableWidth);
  }
  if (node.style.width !== "auto") {
    return Math.min(resolveLength(node.style.width, availableWidth), availableWidth);
  }
  return availableWidth;
}
