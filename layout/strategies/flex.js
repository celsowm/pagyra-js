import { Display } from "../../css/enums.js";
import { containingBlock } from "../utils/node-math.js";
import { resolveLength } from "../../css/length.js";
export class FlexLayoutStrategy {
    supportedDisplays = new Set([Display.Flex, Display.InlineFlex]);
    canLayout(node) {
        return this.supportedDisplays.has(node.style.display);
    }
    layout(node, context) {
        const cb = containingBlock(node, context.env.viewport);
        const isRow = isRowDirection(node.style.flexDirection);
        let mainCursor = 0;
        let crossSize = 0;
        for (const child of node.children) {
            context.layoutChild(child);
            const marginStart = resolveLength(child.style.marginLeft, cb.width, { auto: "zero" });
            const marginEnd = resolveLength(child.style.marginRight, cb.width, { auto: "zero" });
            const marginTop = resolveLength(child.style.marginTop, cb.height, { auto: "zero" });
            const marginBottom = resolveLength(child.style.marginBottom, cb.height, { auto: "zero" });
            const childMainSize = isRow
                ? child.box.borderBoxWidth + marginStart + marginEnd
                : child.box.borderBoxHeight + marginTop + marginBottom;
            const childCrossSize = isRow
                ? child.box.borderBoxHeight + marginTop + marginBottom
                : child.box.borderBoxWidth + marginStart + marginEnd;
            const x = isRow ? node.box.x + mainCursor + marginStart : node.box.x + marginStart;
            const y = isRow ? node.box.y + marginTop : node.box.y + mainCursor + marginTop;
            child.box.x = x;
            child.box.y = y;
            mainCursor += childMainSize;
            crossSize = Math.max(crossSize, childCrossSize);
        }
        if (isRow) {
            node.box.contentWidth = Math.min(mainCursor, cb.width);
            node.box.contentHeight = crossSize;
        }
        else {
            node.box.contentWidth = crossSize;
            node.box.contentHeight = Math.min(mainCursor, cb.height);
        }
        node.box.borderBoxWidth = node.box.contentWidth;
        node.box.borderBoxHeight = node.box.contentHeight;
        node.box.scrollWidth = node.box.contentWidth;
        node.box.scrollHeight = node.box.contentHeight;
    }
}
function isRowDirection(direction) {
    return direction === "row" || direction === "row-reverse";
}
