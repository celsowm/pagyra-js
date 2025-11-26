import { LayoutNode } from "../../dom/node.js";
import { Display } from "../../css/enums.js";
import { resolvedLineHeight } from "../../css/style.js";
import { clampMinMax, resolveLength } from "../../css/length.js";
import type { LayoutContext } from "../pipeline/strategy.js";
import { estimateLineWidth, measureTextWithGlyphs } from "../utils/text-metrics.js";
import { FontEmbedder } from "../../pdf/font/embedder.js";
import type { InlineMetrics } from "./types.js";
import { FloatContext } from "../context/float-context.js";

export type LayoutCallback = (node: LayoutNode, containerWidth: number, context: LayoutContext) => { contentWidth: number; contentHeight: number } | null;

export function measureSegment(text: string, style: LayoutNode["style"], fontEmbedder: FontEmbedder | null): number {
    const metrics = fontEmbedder?.getMetrics(style.fontFamily ?? "");
    const glyphWidth = measureTextWithGlyphs(text, style, metrics ?? null);
    return glyphWidth ?? estimateLineWidth(text, style);
}

export function countSpaces(value: string): number {
    let count = 0;
    for (const char of value) {
        if (char === " ") {
            count += 1;
        }
    }
    return count;
}

export function measureInlineNode(node: LayoutNode, containerWidth: number, context: LayoutContext, layoutCallback: LayoutCallback): InlineMetrics {
    if (node.style.display === Display.InlineBlock || node.style.display === Display.InlineFlex || node.style.display === Display.InlineGrid || node.style.display === Display.InlineTable) {
        const savedX = node.box.x;
        const savedY = node.box.y;
        context.layoutChild(node);
        node.box.x = savedX;
        node.box.y = savedY;
    }

    const marginLeft = resolveLength(node.style.marginLeft, containerWidth, { auto: "zero" });
    const marginRight = resolveLength(node.style.marginRight, containerWidth, { auto: "zero" });
    const marginTop = resolveLength(node.style.marginTop, containerWidth, { auto: "zero" });
    const marginBottom = resolveLength(node.style.marginBottom, containerWidth, { auto: "zero" });

    const inlineChildrenResult = layoutCallback(node, containerWidth, context);

    let contentWidth = node.box.contentWidth;
    let contentHeight = node.box.contentHeight;

    if (inlineChildrenResult) {
        contentWidth = Math.max(contentWidth, inlineChildrenResult.contentWidth);
        contentHeight = Math.max(contentHeight, inlineChildrenResult.contentHeight);
    }

    if (node.style.display === Display.InlineBlock && node.style.width === "auto") {
        const intrinsicWidth = node.box.scrollWidth;
        if (Number.isFinite(intrinsicWidth) && intrinsicWidth > 0 && intrinsicWidth < contentWidth) {
            const minWidth = node.style.minWidth !== undefined ? resolveLength(node.style.minWidth, containerWidth, { auto: "zero" }) : undefined;
            const maxWidth = node.style.maxWidth !== undefined ? resolveLength(node.style.maxWidth, containerWidth, { auto: "reference" }) : undefined;
            const clamped = clampMinMax(intrinsicWidth, minWidth, maxWidth);
            contentWidth = Math.min(clamped, contentWidth);
        }
    }

    if (contentWidth === 0 && !node.textContent) {
        if (typeof node.style.width === "number") {
            contentWidth = node.style.width;
        } else if (node.style.width !== "auto") {
            contentWidth = resolveLength(node.style.width, containerWidth, { auto: "zero" });
        } else if (node.intrinsicInlineSize !== undefined) {
            contentWidth = node.intrinsicInlineSize;
        } else {
            contentWidth = resolvedLineHeight(node.style);
        }
    }

    if (contentHeight === 0 && !node.textContent) {
        if (node.style.height !== "auto") {
            contentHeight = resolveLength(node.style.height, containerWidth, { auto: "zero" });
        } else if (node.intrinsicBlockSize !== undefined) {
            contentHeight = node.intrinsicBlockSize;
        } else {
            contentHeight = resolvedLineHeight(node.style);
        }
    }

    const paddingLeft = resolveLength(node.style.paddingLeft, containerWidth, { auto: "zero" });
    const paddingRight = resolveLength(node.style.paddingRight, containerWidth, { auto: "zero" });
    const paddingTop = resolveLength(node.style.paddingTop, containerWidth, { auto: "zero" });
    const paddingBottom = resolveLength(node.style.paddingBottom, containerWidth, { auto: "zero" });

    const borderLeft = resolveLength(node.style.borderLeft, containerWidth, { auto: "zero" });
    const borderRight = resolveLength(node.style.borderRight, containerWidth, { auto: "zero" });
    const borderTop = resolveLength(node.style.borderTop, containerWidth, { auto: "zero" });
    const borderBottom = resolveLength(node.style.borderBottom, containerWidth, { auto: "zero" });

    node.box.contentWidth = contentWidth;
    node.box.contentHeight = contentHeight;
    node.box.borderBoxWidth = contentWidth + paddingLeft + paddingRight + borderLeft + borderRight;
    node.box.borderBoxHeight = contentHeight + paddingTop + paddingBottom + borderTop + borderBottom;
    node.box.marginBoxWidth = node.box.borderBoxWidth + marginLeft + marginRight;
    node.box.marginBoxHeight = node.box.borderBoxHeight + marginTop + marginBottom;
    node.box.scrollWidth = Math.max(node.box.scrollWidth, node.box.contentWidth);
    node.box.scrollHeight = Math.max(node.box.scrollHeight, node.box.contentHeight);

    return {
        node,
        contentWidth,
        contentHeight,
        lineOffset: 0,
        marginLeft,
        marginRight,
        marginTop,
        marginBottom,
        paddingLeft,
        paddingRight,
        paddingTop,
        paddingBottom,
        borderLeft,
        borderRight,
        borderTop,
        borderBottom,
        outerWidth: node.box.marginBoxWidth,
        outerHeight: node.box.marginBoxHeight,
    };
}

function inlineExtentWithinContainer(node: LayoutNode, referenceWidth: number): { start: number; end: number } {
    const marginLeft = resolveLength(node.style.marginLeft, referenceWidth, { auto: "zero" });
    const marginRight = resolveLength(node.style.marginRight, referenceWidth, { auto: "zero" });
    const paddingLeft = resolveLength(node.style.paddingLeft, referenceWidth, { auto: "zero" });
    const paddingRight = resolveLength(node.style.paddingRight, referenceWidth, { auto: "zero" });
    const borderLeft = resolveLength(node.style.borderLeft, referenceWidth, { auto: "zero" });
    const borderRight = resolveLength(node.style.borderRight, referenceWidth, { auto: "zero" });

    const marginStart = node.box.x - paddingLeft - borderLeft - marginLeft;
    const width =
        node.box.contentWidth + paddingLeft + paddingRight + borderLeft + borderRight + marginLeft + marginRight;

    return {
        start: marginStart,
        end: marginStart + width,
    };
}
