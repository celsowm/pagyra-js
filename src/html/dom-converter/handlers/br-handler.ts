import { Display } from "../../../css/enums.js";
import { cloneLineHeight } from "../../../css/line-height.js";
import { ComputedStyle } from "../../../css/style.js";
import { LayoutNode } from "../../../dom/node.js";
import type { SpecialElementHandler } from "./types.js";

function createBreakNode(parentStyle: ComputedStyle): LayoutNode {
  const textStyle = new ComputedStyle({
    display: Display.Inline,
    color: parentStyle.color,
    fontSize: parentStyle.fontSize,
    lineHeight: cloneLineHeight(parentStyle.lineHeight),
    fontFamily: parentStyle.fontFamily,
    fontWeight: parentStyle.fontWeight,
    fontStyle: parentStyle.fontStyle,
    textTransform: parentStyle.textTransform,
  });
  return new LayoutNode(textStyle, [], { textContent: "\n" });
}

export const brHandler: SpecialElementHandler = ({ parentStyle }) => {
  return createBreakNode(parentStyle);
};
