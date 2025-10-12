import { LayoutNode } from "../../dom/node.js";
import { Display } from "../../css/enums.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import { containingBlock } from "../utils/node-math.js";

export class GridLayoutStrategy implements LayoutStrategy {
  private readonly supportedDisplays = new Set<Display>([Display.Grid, Display.InlineGrid]);

  canLayout(node: LayoutNode): boolean {
    return this.supportedDisplays.has(node.style.display);
  }

  layout(node: LayoutNode, context: LayoutContext): void {
    const cb = containingBlock(node, context.env.viewport);
    const columnCount = Math.max(node.style.trackListColumns.length || 1, 1);
    const columnWidth = cb.width / columnCount;

    let row = 0;
    let column = 0;
    let contentHeight = 0;

    for (const child of node.children) {
      context.layoutChild(child);

      const x = node.box.x + column * columnWidth;
      const y = node.box.y + row * child.box.borderBoxHeight;

      child.box.x = x;
      child.box.y = y;

      column += 1;
      if (column >= columnCount) {
        column = 0;
        row += 1;
        contentHeight += child.box.borderBoxHeight;
      }
    }

    node.box.contentWidth = cb.width;
    node.box.contentHeight = contentHeight;
    node.box.borderBoxWidth = node.box.contentWidth;
    node.box.borderBoxHeight = node.box.contentHeight;
    node.box.scrollWidth = node.box.contentWidth;
    node.box.scrollHeight = node.box.contentHeight;
  }
}
