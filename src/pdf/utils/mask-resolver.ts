import type { LayoutNode } from "../../dom/node.js";
import type { Rect, GradientBackground } from "../types.js";
import { parseRadialGradient, parseLinearGradient } from "../../css/parsers/gradient-parser.js";

export function resolveMaskGradient(node: LayoutNode, boxes: { borderBox: Rect; paddingBox: Rect; contentBox: Rect }): GradientBackground | undefined {
  const mask = node.style.mask;
  if (!mask) return undefined;

  const radial = parseRadialGradient(mask);
  if (radial) {
    return {
      gradient: radial,
      rect: boxes.borderBox,
      repeat: "no-repeat",
      originRect: boxes.borderBox,
    };
  }

  const linear = parseLinearGradient(mask);
  if (linear) {
    return {
      gradient: linear,
      rect: boxes.borderBox,
      repeat: "no-repeat",
      originRect: boxes.borderBox,
    };
  }

  return undefined;
}
