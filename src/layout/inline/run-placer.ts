import { LayoutNode, type InlineRun } from "../../dom/node.js";
import type { LayoutItem } from "./types.js";
import { isBoxItem } from "./types.js";
import { placeInlineItem } from "./layout.js";
import { calculateBaseline } from "./font-baseline-calculator.js";
import type { FontEmbedder } from "../../pdf/font/embedder.js";

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

        const { lineTop, lineHeight, lineStartX, lineIndex, availableWidth, offsetShift, isLastLine, contentX, inlineOffsetStart } = lineContext;

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
                placeInlineItem(metrics, contentX + inlineOffsetStart, lineTop);
                continue;
            }

            // Handle text items
            const node = part.item.node;
            if (!node || !part.item.text) {
                continue;
            }

            // Calculate baseline based on the item's fontSize and lineHeight
            const fontSize = part.item.style?.fontSize ?? 16;
            const itemLineHeight = part.item.lineHeight ?? lineHeight;

            // Use calculateBaseline with font metrics when available
            const fontFamily = part.item.style?.fontFamily ?? "sans-serif";
            const fontWeight = part.item.style?.fontWeight ?? 400;
            const fontStyle = part.item.style?.fontStyle ?? "normal";

            const fontMetrics = this.fontEmbedder?.getMetrics(fontFamily, fontWeight, fontStyle);
            const lineBaseline = calculateBaseline(lineTop, fontSize, itemLineHeight, fontMetrics);

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

            // Update node.box.x to track the minimum startX across all runs for this node
            // This ensures the bounding box starts at the leftmost run position
            if (!this.nodeRuns.has(node)) {
                // First run for this node - set initial position
                node.box.x = startX;
                node.box.y = lineTop;
            } else {
                // Multiple runs -use the minimum X and Y to encompass all runs
                node.box.x = Math.min(node.box.x, startX);
                node.box.y = Math.min(node.box.y, lineTop);
            }
            node.box.baseline = lineBaseline;
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
