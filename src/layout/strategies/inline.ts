import { LayoutNode } from "../../dom/node.js";
import { Display } from "../../css/enums.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";

export class InlineLayoutStrategy implements LayoutStrategy {
  canLayout(node: LayoutNode): boolean {
    return node.style.display === Display.Inline;
  }

  layout(node: LayoutNode, _context: LayoutContext): void {
    node.box.contentWidth = 0;
    node.box.contentHeight = 0;
    node.box.borderBoxWidth = 0;
    node.box.borderBoxHeight = 0;
  }
}
