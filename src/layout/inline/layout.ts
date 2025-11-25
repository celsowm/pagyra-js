import { LayoutNode, type InlineRun } from "../../dom/node.js";
import { Display, FloatMode } from "../../css/enums.js";
import { resolvedLineHeight } from "../../css/style.js";
import { resolveLength } from "../../css/length.js";
import type { InlineLayoutOptions, InlineLayoutResult, LayoutItem, InlineMetrics } from "./types.js";
import { isBoxItem } from "./types.js";
import { collectInlineFragments, tokenizeFragments, splitWordItemToken } from "./tokenizer.js";
import { FloatContext } from "../context/float-context.js";

const LAYOUT_DEBUG = process.env.PAGYRA_DEBUG_LAYOUT === "1";
const layoutDebug = (...args: unknown[]): void => {
    if (LAYOUT_DEBUG) {
        // console.log(...args);
    }
};

function resolveInlineTextAlign(node: LayoutNode): string | undefined {
    let current: LayoutNode | null = node;
    while (current) {
        const value = current.style.textAlign;
        if (value) {
            const normalized = value.toLowerCase();
            if (normalized !== "start" && normalized !== "auto") {
                return normalized;
            }
        }
        current = current.parent;
    }
    return undefined;
}

export function layoutInlineFormattingContext(options: InlineLayoutOptions): InlineLayoutResult {
    const { container, inlineNodes, context, floatContext, contentX, contentWidth } = options;
    container.establishesIFC = true;

    const textAlign = container.style.display === Display.Inline
        ? undefined
        : resolveInlineTextAlign(container);
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
    const nodeRuns = new Map<LayoutNode, InlineRun[]>();

    let maxInlineEnd = 0;

    const pushRun = (
        node: LayoutNode,
        run: InlineRun,
    ) => {
        const existing = nodeRuns.get(node);
        if (existing) {
            existing.push(run);
        } else {
            nodeRuns.set(node, [run]);
        }
    };

    const placeRunsForLine = (parts: { item: LayoutItem; offset: number }[], isLastLine: boolean) => {
        const trimmed = parts;
        if (trimmed.length === 0) {
            return;
        }

        const lineWidth = trimmed.reduce((max, part) => Math.max(max, part.offset + part.item.width), 0);
        const currentAvailableWidth = Math.max(availableWidth, 0);
        const slack = Math.max(currentAvailableWidth - lineWidth, 0);
        let offsetShift = 0;
        if (textAlign === "center") {
            offsetShift = slack / 2;
        } else if (textAlign === "right" || textAlign === "end") {
            offsetShift = slack;
        }

        const lineStartX = contentX + inlineOffset.start + offsetShift;
        const lineBaseline = lineTop + lineHeight;
        const spaceCount = trimmed.reduce((count, part) => {
            if (part.item.kind === "space") {
                return count + (part.item.spaceCount ?? 1);
            }
            return count;
        }, 0);
        maxInlineEnd = Math.max(maxInlineEnd, lineStartX + lineWidth - contentX);

        for (const part of trimmed) {
            if (isBoxItem(part.item)) {
                const metrics = part.item.metrics;
                metrics.lineOffset = part.offset + offsetShift;
                placeInlineItem(metrics, contentX + inlineOffset.start, lineTop);
                continue;
            }

            const node = part.item.node;
            if (!node || !part.item.text) {
                continue;
            }
            const startX = lineStartX + part.offset;
            const run: InlineRun = {
                lineIndex,
                startX,
                baseline: lineBaseline,
                text: part.item.text,
                width: part.item.width,
                lineWidth,
                targetWidth: currentAvailableWidth,
                spaceCount: spaceCount,
                isLastLine,
            };
            node.box.x = startX;
            node.box.y = lineTop;
            node.box.baseline = lineBaseline;
            pushRun(node, run);
        }
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

    // Assign runs back to nodes and compute per-node sizes for text.
    for (const [node, runs] of nodeRuns.entries()) {
        node.inlineRuns = runs;
        node.lineBoxes = undefined;
        const lineCount = runs.reduce((max, run) => Math.max(max, run.lineIndex + 1), 0);
        const lh = resolvedLineHeight(node.style);
        node.box.contentHeight = lineCount * lh;
        const maxWidth = runs.reduce((max, run) => Math.max(max, run.lineWidth ?? run.width), 0);
        node.box.contentWidth = maxWidth;
        node.box.borderBoxWidth = maxWidth;
        node.box.borderBoxHeight = node.box.contentHeight;
        node.box.marginBoxWidth = node.box.borderBoxWidth;
        node.box.marginBoxHeight = node.box.borderBoxHeight;
        node.box.scrollWidth = Math.max(node.box.scrollWidth, node.box.contentWidth);
        node.box.scrollHeight = Math.max(node.box.scrollHeight, node.box.contentHeight);
    }

    return { newCursorY: lineTop };
}

export function placeInlineItem(item: InlineMetrics, lineStartX: number, lineTop: number): void {
    const { node } = item;
    const contentX = lineStartX + item.lineOffset + item.marginLeft + item.borderLeft + item.paddingLeft;
    const contentY = lineTop + item.marginTop + item.borderTop + item.paddingTop;
    layoutDebug(
        `[placeInlineItem] node=${node.tagName ?? "(anonymous)"} lineStartX=${lineStartX} lineOffset=${item.lineOffset} marginLeft=${item.marginLeft} paddingLeft=${item.paddingLeft} borderLeft=${item.borderLeft} -> contentX=${contentX}`,
    );

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
    node.walk((child) => {
        if (child === node) {
            return;
        }
        child.box.x += deltaX;
        child.box.y += deltaY;
        child.box.baseline += deltaY;
    }, false);
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

function shouldLayoutInlineChildren(node: LayoutNode): boolean {
    if (node.children.length === 0) {
        return false;
    }
    if (node.style.display !== Display.Inline) {
        return false;
    }
    return true;
}

function collectInlineParticipants(node: LayoutNode): LayoutNode[] {
    const participants: LayoutNode[] = [];
    for (const child of node.children) {
        if (child.style.display === Display.None) {
            continue;
        }
        if (child.style.float !== FloatMode.None) {
            continue;
        }
        if (!isInlineDisplay(child.style.display)) {
            continue;
        }
        participants.push(child);
    }
    return participants;
}

function isInlineDisplay(display: Display): boolean {
    switch (display) {
        case Display.Inline:
        case Display.InlineBlock:
        case Display.InlineFlex:
        case Display.InlineGrid:
        case Display.InlineTable:
            return true;
        default:
            return false;
    }
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
