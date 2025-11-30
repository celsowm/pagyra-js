import { LayoutNode, type InlineRun } from "../../dom/node.js";
import { Display, FloatMode } from "../../css/enums.js";
import { resolvedLineHeight } from "../../css/style.js";
import { resolveLength } from "../../css/length.js";
import type { InlineLayoutOptions, InlineLayoutResult, LayoutItem, InlineMetrics } from "./types.js";
import { isBoxItem } from "./types.js";
import type { LayoutContext } from "../pipeline/strategy.js";
import { collectInlineFragments, tokenizeFragments, splitWordItemToken } from "./tokenizer.js";
import { FloatContext } from "../context/float-context.js";
import {
    resolveInlineTextAlign,
    isInlineDisplay,
    shouldLayoutInlineChildren,
    collectInlineParticipants,
    inlineExtentWithinContainer,
} from "./inline-utils.js";
import { getAlignmentStrategy, type TextAlignmentStrategy } from "./text-alignment.js";
import { BoundingBoxCalculator } from "./bounding-box-calculator.js";
import { RunPlacer } from "./run-placer.js";
import { createLayoutDebug } from "../debug.js";



export function layoutInlineFormattingContext(options: InlineLayoutOptions): InlineLayoutResult {
    const { container, inlineNodes, context, floatContext, contentX, contentWidth } = options;
    container.establishesIFC = true;
    const layoutDebug = createLayoutDebug(context);

    const textAlign = container.style.display === Display.Inline
        ? undefined
        : resolveInlineTextAlign(container);
    const alignmentStrategy = getAlignmentStrategy(textAlign);
    const shouldApplyTextIndent = container.style.display !== Display.Inline;
    const resolvedTextIndent = shouldApplyTextIndent
        ? resolveLength(container.style.textIndent, contentWidth, { auto: "zero" })
        : 0;
    let firstLineTextIndentPending = shouldApplyTextIndent && resolvedTextIndent !== 0;

    const layoutCallback = (node: LayoutNode, width: number, ctx: any) => layoutInlineChildrenIfNeeded(node, width, ctx);
    const fragments = collectInlineFragments(inlineNodes, contentWidth, context, layoutCallback);
    const items = tokenizeFragments(fragments, context.env.fontEmbedder);

    let lineTop = options.startY;
    let lineHeight = Math.max(resolvedLineHeight(container.style), 0);
    let inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
    let availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
    let cursorX = 0;
    let lineIndex = 0;
    const lineParts: { item: LayoutItem; offset: number }[] = [];
    const runPlacer = new RunPlacer(context.env.fontEmbedder);

    const placeRunsForLine = (parts: { item: LayoutItem; offset: number }[], isLastLine: boolean) => {
        const offsetShift = alignmentStrategy.calculateOffset(
            parts.reduce((max, part) => Math.max(max, part.offset + part.item.width), 0),
            Math.max(availableWidth, 0)
        );

        runPlacer.placeRunsForLine(parts, {
            lineTop,
            lineHeight,
            lineStartX: contentX + inlineOffset.start + offsetShift,
            lineIndex,
            availableWidth,
            offsetShift,
            isLastLine,
            contentX,
            inlineOffsetStart: inlineOffset.start,
        });
    };

    const commitLine = (isLastLine: boolean) => {
        if (lineParts.length === 0) {
            lineTop += lineHeight;
        } else {
            placeRunsForLine(lineParts, isLastLine);
            lineTop += lineHeight;
        }
        cursorX = 0;
        lineHeight = Math.max(resolvedLineHeight(container.style), 0);
        lineParts.length = 0;
        inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
        availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
        lineIndex += 1;
    };

    for (let index = 0; index < items.length; index++) {
        const item = items[index];

        if (item.kind === "newline") {
            commitLine(false);
            continue;
        }

        let workingItem: LayoutItem | null = item;

        while (workingItem) {
            if (availableWidth <= 0) {
                const nextLineTop = floatContext.nextUnblockedY(lineTop, lineTop + lineHeight);
                if (nextLineTop === null) {
                    // No floats to skip; allow overflow on this line.
                    availableWidth = Math.max(0, contentWidth);
                    inlineOffset = { start: 0, end: contentWidth };
                } else {
                    lineTop = nextLineTop;
                    inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
                    availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
                    cursorX = 0;
                    lineParts.length = 0;
                    continue;
                }
            }

            if (lineParts.length === 0 && firstLineTextIndentPending) {
                cursorX += resolvedTextIndent;
                firstLineTextIndentPending = false;
            }

            const remaining = Math.max(availableWidth - cursorX, 0);

            if (workingItem.kind === "box") {
                if (lineParts.length > 0 && cursorX + workingItem.width > availableWidth) {
                    commitLine(false);
                    continue;
                }
                if (lineParts.length === 0 && workingItem.width > availableWidth) {
                    const nextLineTop = floatContext.nextUnblockedY(lineTop, lineTop + lineHeight);
                    if (nextLineTop === null) {
                        lineParts.push({ item: workingItem, offset: cursorX });
                        cursorX += workingItem.width;
                        lineHeight = Math.max(lineHeight, workingItem.lineHeight);
                        break;
                    }
                    lineTop = nextLineTop;
                    inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
                    availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
                    cursorX = 0;
                    lineParts.length = 0;
                    continue;
                }

                lineParts.push({ item: workingItem, offset: cursorX });
                cursorX += workingItem.width;
                lineHeight = Math.max(lineHeight, workingItem.lineHeight);
                break;
            }

            // Text items
            if (workingItem.kind === "word" && workingItem.width > remaining) {
                const mode = workingItem.style?.overflowWrap ?? "normal";
                if (mode !== "normal" && remaining > 0) {
                    const [head, tail] = splitWordItemToken(workingItem, remaining);
                    if (head) {
                        lineParts.push({ item: head, offset: cursorX });
                        cursorX += head.width;
                        lineHeight = Math.max(lineHeight, head.lineHeight);
                    }
                    if (tail) {
                        items.splice(index + 1, 0, tail);
                    }
                    workingItem = null;
                    break;
                }
            }

            if (lineParts.length > 0 && cursorX + workingItem.width > availableWidth) {
                commitLine(false);
                continue;
            }

            if (lineParts.length === 0 && workingItem.width > availableWidth && workingItem.kind === "word") {
                const nextLineTop = floatContext.nextUnblockedY(lineTop, lineTop + lineHeight);
                if (nextLineTop === null) {
                    lineParts.push({ item: workingItem, offset: cursorX });
                    cursorX += workingItem.width;
                    lineHeight = Math.max(lineHeight, workingItem.lineHeight);
                    workingItem = null;
                    break;
                }
                lineTop = nextLineTop;
                inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
                availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
                cursorX = 0;
                lineParts.length = 0;
                continue;
            }

            lineParts.push({ item: workingItem, offset: cursorX });
            cursorX += workingItem.width;
            lineHeight = Math.max(lineHeight, workingItem.lineHeight);
            workingItem = null;
        }
    }

    if (lineParts.length > 0) {
        commitLine(true);
    }

    // Compute per-node sizes and propagate bounding boxes
    const nodeRuns = runPlacer.getNodeRuns();
    const boxCalculator = new BoundingBoxCalculator();
    boxCalculator.computeNodeBoxes(nodeRuns);
    boxCalculator.propagateBoundingBoxes(nodeRuns, container);

    return { newCursorY: lineTop };
}

export function placeInlineItem(item: InlineMetrics, lineStartX: number, lineTop: number, context?: LayoutContext): void {
    const { node } = item;
    const contentX = lineStartX + item.lineOffset + item.marginLeft + item.borderLeft + item.paddingLeft;
    const contentY = lineTop + item.marginTop + item.borderTop + item.paddingTop;
    const layoutDebug = context ? createLayoutDebug(context) : (): void => { /* no-op */ };
    layoutDebug(`[placeInlineItem] node=${node.tagName ?? "(anonymous)"} lineStartX=${lineStartX} lineOffset=${item.lineOffset} marginLeft=${item.marginLeft} paddingLeft=${item.paddingLeft} borderLeft=${item.borderLeft} -> contentX=${contentX}`);

    const previousX = node.box.x;
    const previousY = node.box.y;

    node.box.x = contentX;
    node.box.y = contentY;
    node.box.baseline = contentY + item.contentHeight;

    const deltaX = node.box.x - previousX;
    const deltaY = node.box.y - previousY;
    if (deltaX !== 0 || deltaY !== 0) {
        offsetInlineDescendants(node, deltaX, deltaY);
    }
}

export function offsetInlineDescendants(node: LayoutNode, deltaX: number, deltaY: number): void {
    for (const child of node.children) {
        child.shift(deltaX, deltaY);
    }
}

function layoutInlineChildrenIfNeeded(
    node: LayoutNode,
    containerWidth: number,
    context: any, // Using any to avoid circular type dependency if needed, or import LayoutContext
): { contentWidth: number; contentHeight: number } | null {
    if (!shouldLayoutInlineChildren(node)) {
        return null;
    }

    const inlineChildren = collectInlineParticipants(node);
    if (inlineChildren.length === 0) {
        return null;
    }

    const savedX = node.box.x;
    const savedY = node.box.y;
    node.box.x = 0;
    node.box.y = 0;

    for (const child of inlineChildren) {
        child.box.x = 0;
        child.box.y = 0;
    }

    const localFloatContext = new FloatContext();
    const result = layoutInlineFormattingContext({
        container: node,
        inlineNodes: inlineChildren,
        context,
        floatContext: localFloatContext,
        contentX: 0,
        contentWidth: Math.max(containerWidth, 0),
        startY: 0,
    });

    const floatBottom = Math.max(localFloatContext.bottom("left"), localFloatContext.bottom("right"));
    const contentHeight = Math.max(result.newCursorY, floatBottom);

    let maxInlineEnd = 0;
    for (const child of inlineChildren) {
        const extent = inlineExtentWithinContainer(child, containerWidth);
        maxInlineEnd = Math.max(maxInlineEnd, extent.end);
    }

    node.box.x = savedX;
    node.box.y = savedY;

    return {
        contentWidth: Math.max(0, maxInlineEnd),
        contentHeight: Math.max(0, contentHeight),
    };
}
