import { Display } from "../../css/enums.js";
import { containingBlock } from "../utils/node-math.js";
export class GridLayoutStrategy {
    supportedDisplays = new Set([Display.Grid, Display.InlineGrid]);
    canLayout(node) {
        return this.supportedDisplays.has(node.style.display);
    }
    layout(node, context) {
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
