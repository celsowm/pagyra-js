import { LayoutNode, type InlineRun } from "../../dom/node.js";
import type { LayoutItem } from "./types.js";
import { isBoxItem } from "./types.js";
import { placeInlineItem } from "./layout.js";
import type { FontEmbedder } from "../../pdf/font/embedder.js";
import { parseLengthOrPercent } from "../../css/parsers/length-parser.js";
import { resolveLength, resolveLengthInput } from "../../css/length.js";
import { calculateBaseline } from "./font-baseline-calculator.js";

/**
 * Context information for placing runs on a specific line
 */
export interface LineContext {
    lineTop: number;
    lineHeight: number;
    lineStartX: number;
    lineIndex: number;
    availableWidth: number;
    offsetShift: number;
    isLastLine: boolean;
    contentX: number;
    inlineOffsetStart: number;
    lineBaseline: number;
}

/**
 * Responsible for placing text runs and box items on lines.
 * Tracks runs per node and handles both text and inline-block layouts.
 */
export class RunPlacer {
    private nodeRuns = new Map<LayoutNode, InlineRun[]>();
    private maxInlineEnd = 0;

    constructor(private readonly fontEmbedder: FontEmbedder | null = null) { }

    /**
     * Place all items on a line, creating InlineRun objects for text and positioning box items.
     */
    placeRunsForLine(
        parts: { item: LayoutItem; offset: number }[],
        lineContext: LineContext
    ): void {
        if (parts.length === 0) {
            return;
        }

        const { lineTop, lineStartX, lineIndex, availableWidth, offsetShift, isLastLine, contentX, inlineOffsetStart } = lineContext;

        const lineWidth = parts.reduce((max, part) => Math.max(max, part.offset + part.item.width), 0);
        const currentAvailableWidth = Math.max(availableWidth, 0);

        const spaceCount = parts.reduce((count, part) => {
            if (part.item.kind === "space") {
                return count + (part.item.spaceCount ?? 1);
            }
            return count;
        }, 0);

        this.maxInlineEnd = Math.max(this.maxInlineEnd, lineStartX + lineWidth - contentX);

        for (const part of parts) {
            // Handle box items (inline-block, etc.)
            if (isBoxItem(part.item)) {
                const metrics = part.item.metrics;
                metrics.lineOffset = part.offset + offsetShift;
                const topOffset = this.resolveBoxTopOffset(part.item, lineContext);
                placeInlineItem(metrics, contentX + inlineOffsetStart, lineTop + topOffset);
                continue;
            }

            // Handle text items
            const node = part.item.node;
            if (!node || !part.item.text) {
                continue;
            }

            const baseline = this.resolveTextBaseline(part.item, lineContext);
            const startX = lineStartX + part.offset;
            const run: InlineRun = {
                lineIndex,
                startX,
                baseline,
                text: part.item.text,
                width: part.item.width,
                lineWidth,
                targetWidth: currentAvailableWidth,
                spaceCount: spaceCount,
                isLastLine,
            };

            // Update node.box.x to track the minimum startX across all runs for this node
            // This ensures the bounding box starts at the leftmost run position
            if (!this.nodeRuns.has(node)) {
                // First run for this node - set initial position
                node.box.x = startX;
                node.box.y = lineTop + (baseline - lineContext.lineBaseline);
            } else {
                // Multiple runs - use the minimum X and Y to encompass all runs
                node.box.x = Math.min(node.box.x, startX);
                node.box.y = Math.min(node.box.y, lineTop + (baseline - lineContext.lineBaseline));
            }
            node.box.baseline = baseline;
            this.pushRun(node, run);
        }
    }

    /**
     * Get all collected node runs
     */
    getNodeRuns(): Map<LayoutNode, InlineRun[]> {
        return this.nodeRuns;
    }

    /**
     * Get the maximum inline end position seen
     */
    getMaxInlineEnd(): number {
        return this.maxInlineEnd;
    }

    private resolveTextBaseline(item: LayoutItem, context: LineContext): number {
        const style = item.style;
        if (!style) {
            return context.lineBaseline;
        }

        const value = (style.verticalAlign ?? "baseline").trim().toLowerCase();
        const fontSize = style.fontSize ?? 16;
        const itemLineHeight = Math.max(item.lineHeight, 0);
        const metrics = this.fontEmbedder?.getMetrics(
            style.fontFamily ?? "sans-serif",
            style.fontWeight ?? 400,
            style.fontStyle ?? "normal",
        );

        switch (value) {
            case "baseline":
                return context.lineBaseline;
            case "sub":
                return context.lineBaseline + fontSize * 0.2;
            case "super":
                return context.lineBaseline - fontSize * 0.4;
            case "top":
            case "text-top":
                return calculateBaseline(context.lineTop, fontSize, itemLineHeight, metrics);
            case "bottom":
            case "text-bottom":
                return calculateBaseline(
                    context.lineTop + Math.max(context.lineHeight - itemLineHeight, 0),
                    fontSize,
                    itemLineHeight,
                    metrics,
                );
            case "middle": {
                const ownBaseline = calculateBaseline(0, fontSize, itemLineHeight, metrics);
                const ownMiddleToBaseline = ownBaseline - itemLineHeight / 2;
                const parentXHeightHalf = fontSize * 0.25;
                return context.lineBaseline + parentXHeightHalf + ownMiddleToBaseline;
            }
            default: {
                const shift = this.resolveNumericVerticalShift(value, fontSize, itemLineHeight);
                return shift === undefined ? context.lineBaseline : context.lineBaseline - shift;
            }
        }
    }

    private resolveBoxTopOffset(item: LayoutItem, context: LineContext): number {
        const style = isBoxItem(item) ? item.metrics.node.style : item.style;
        if (!style) {
            return 0;
        }
        const value = (style.verticalAlign ?? "baseline").trim().toLowerCase();
        const fontSize = style.fontSize ?? 16;
        switch (value) {
            case "top":
            case "text-top":
            case "baseline":
                return 0;
            case "bottom":
            case "text-bottom":
                return Math.max(context.lineHeight - item.lineHeight, 0);
            case "middle":
                return (context.lineHeight - item.lineHeight) / 2;
            case "sub":
                return fontSize * 0.2;
            case "super":
                return -fontSize * 0.4;
            default: {
                const shift = this.resolveNumericVerticalShift(value, fontSize, item.lineHeight);
                return shift === undefined ? 0 : -shift;
            }
        }
    }

    private resolveNumericVerticalShift(value: string, fontSize: number, lineHeight: number): number | undefined {
        const parsed = parseLengthOrPercent(value);
        if (parsed === undefined) {
            return undefined;
        }
        const resolved = resolveLengthInput(parsed, fontSize, fontSize);
        return resolveLength(resolved, lineHeight, { auto: "zero" });
    }

    /**
     * Add a run to a node's run list
     */
    private pushRun(node: LayoutNode, run: InlineRun): void {
        const existing = this.nodeRuns.get(node);
        if (existing) {
            existing.push(run);
        } else {
            this.nodeRuns.set(node, [run]);
        }
    }
}
