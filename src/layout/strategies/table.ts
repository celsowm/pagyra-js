import { LayoutNode } from "../../dom/node.js";
import { Display } from "../../css/enums.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import { containingBlock } from "../utils/node-math.js";

export class TableLayoutStrategy implements LayoutStrategy {
  private readonly supportedDisplays = new Set<Display>([Display.Table, Display.InlineTable]);

  canLayout(node: LayoutNode): boolean {
    return this.supportedDisplays.has(node.style.display);
  }

  layout(node: LayoutNode, context: LayoutContext): void {
    const cb = containingBlock(node, context.env.viewport);
    let contentHeight = 0;

    for (const child of node.children) {
      context.layoutChild(child);
      child.box.x = node.box.x;
      child.box.y = node.box.y + contentHeight;
      contentHeight += child.box.borderBoxHeight;
    }

    node.box.contentWidth = cb.width;
    node.box.contentHeight = contentHeight;
    node.box.borderBoxWidth = node.box.contentWidth;
    node.box.borderBoxHeight = node.box.contentHeight;
    node.box.scrollWidth = node.box.contentWidth;
    node.box.scrollHeight = node.box.contentHeight;
  }
}
