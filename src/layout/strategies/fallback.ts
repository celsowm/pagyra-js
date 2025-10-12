import { LayoutNode } from "../../dom/node.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";

export class FallbackStrategy implements LayoutStrategy {
  canLayout(): boolean {
    return true;
  }

  layout(node: LayoutNode, _context: LayoutContext): void {
    node.box.contentWidth = 0;
    node.box.contentHeight = 0;
    node.box.borderBoxWidth = 0;
    node.box.borderBoxHeight = 0;
  }
}
