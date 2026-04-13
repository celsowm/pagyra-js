import type { LayoutNode } from "../../dom/node.js";
import type { Rect, GradientBackground } from "../types.js";
import { parseRadialGradient, parseLinearGradient } from "../../css/parsers/gradient-parser.js";
import { splitCssCommaList } from "../../css/utils.js";

export function resolveMaskGradients(node: LayoutNode, boxes: { borderBox: Rect; paddingBox: Rect; contentBox: Rect }): GradientBackground[] {
  const mask = node.style.mask;
  if (!mask) return [];

  const masks = splitCssCommaList(mask);
  const result: GradientBackground[] = [];

  for (const m of masks) {
    const radial = parseRadialGradient(m);
    if (radial) {
      result.push({
        gradient: radial,
        rect: { ...boxes.borderBox },
        repeat: "no-repeat",
        originRect: { ...boxes.borderBox },
      });
      continue;
    }

    const linear = parseLinearGradient(m);
    if (linear) {
      result.push({
        gradient: linear,
        rect: { ...boxes.borderBox },
        repeat: "no-repeat",
        originRect: { ...boxes.borderBox },
      });
    }
  }

  return result;
}
