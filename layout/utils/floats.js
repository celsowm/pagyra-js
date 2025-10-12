import { ClearMode, FloatMode } from "../../css/enums.js";
import { resolveLength } from "../../css/length.js";
export function clearForBlock(node, floatContext, yCursor) {
    const { clear } = node.style;
    let y = yCursor;
    if (clear === ClearMode.Left || clear === ClearMode.Both || clear === ClearMode.InlineStart) {
        y = Math.max(y, floatContext.bottom("left"));
    }
    if (clear === ClearMode.Right || clear === ClearMode.Both || clear === ClearMode.InlineEnd) {
        y = Math.max(y, floatContext.bottom("right"));
    }
    return y;
}
export function placeFloat(options) {
    const { node, floatContext, context, contentX, contentWidth } = options;
    context.layoutChild(node);
    const marginLeft = resolveLength(node.style.marginLeft, contentWidth, { auto: "zero" });
    const marginRight = resolveLength(node.style.marginRight, contentWidth, { auto: "zero" });
    const marginTop = resolveLength(node.style.marginTop, contentWidth, { auto: "zero" });
    const marginBottom = resolveLength(node.style.marginBottom, contentWidth, { auto: "zero" });
    const borderLeft = resolveLength(node.style.borderLeft, contentWidth, { auto: "zero" });
    const borderRight = resolveLength(node.style.borderRight, contentWidth, { auto: "zero" });
    const borderTop = resolveLength(node.style.borderTop, contentWidth, { auto: "zero" });
    const borderBottom = resolveLength(node.style.borderBottom, contentWidth, { auto: "zero" });
    const paddingLeft = resolveLength(node.style.paddingLeft, contentWidth, { auto: "zero" });
    const paddingRight = resolveLength(node.style.paddingRight, contentWidth, { auto: "zero" });
    const paddingTop = resolveLength(node.style.paddingTop, contentWidth, { auto: "zero" });
    const paddingBottom = resolveLength(node.style.paddingBottom, contentWidth, { auto: "zero" });
    const borderBoxWidth = node.box.contentWidth + paddingLeft + paddingRight + borderLeft + borderRight;
    const borderBoxHeight = node.box.contentHeight + paddingTop + paddingBottom + borderTop + borderBottom;
    node.box.borderBoxWidth = borderBoxWidth;
    node.box.borderBoxHeight = borderBoxHeight;
    node.box.marginBoxWidth = borderBoxWidth + marginLeft + marginRight;
    node.box.marginBoxHeight = borderBoxHeight + marginTop + marginBottom;
    const outerWidth = node.box.marginBoxWidth;
    const outerHeight = node.box.marginBoxHeight;
    let y = options.startY;
    let attempts = 0;
    while (true) {
        if (attempts > 1000) {
            break;
        }
        const offsets = floatContext.inlineOffsets(y, y + outerHeight, contentWidth);
        const availableWidth = Math.max(0, offsets.end - offsets.start);
        if (outerWidth <= availableWidth) {
            const marginBoxStart = node.style.float === FloatMode.Left
                ? contentX + offsets.start
                : contentX + offsets.end - outerWidth;
            const contentXPosition = marginBoxStart + marginLeft + borderLeft + paddingLeft;
            const contentYPosition = y + marginTop + borderTop + paddingTop;
            node.box.x = contentXPosition;
            node.box.y = contentYPosition;
            node.box.scrollWidth = node.box.contentWidth;
            node.box.scrollHeight = node.box.contentHeight;
            floatContext.register(node.style.float === FloatMode.Left ? "left" : "right", {
                top: y,
                bottom: y + outerHeight,
                inlineStart: marginBoxStart - contentX,
                inlineEnd: marginBoxStart - contentX + outerWidth,
            });
            return y + outerHeight;
        }
        const nextY = floatContext.nextUnblockedY(y, y + outerHeight);
        if (nextY === null || nextY <= y) {
            y += 1;
        }
        else {
            y = nextY;
        }
        attempts += 1;
    }
    return y + outerHeight;
}
