import { Display } from "../../css/enums.js";
import { containingBlock } from "../utils/node-math.js";
export class TableLayoutStrategy {
    supportedDisplays = new Set([Display.Table, Display.InlineTable]);
    canLayout(node) {
        return this.supportedDisplays.has(node.style.display);
    }
    layout(node, context) {
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
