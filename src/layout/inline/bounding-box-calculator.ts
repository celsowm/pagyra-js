import { LayoutNode, type InlineRun } from "../../dom/node.js";
import { resolvedLineHeight } from "../../css/style.js";
import { isInlineDisplay } from "./inline-utils.js";

/**
 * Represents a bounding rectangle with min/max coordinates
 */
interface BoundingRect {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/**
 * Responsible for computing and propagating bounding boxes for inline nodes.
 * Handles both the initial box calculation from runs and the propagation to ancestors.
 */
export class BoundingBoxCalculator {
    private boundingBoxes = new Map<LayoutNode, BoundingRect>();

    /**
     * Compute per-node box sizes from their inline runs.
     * Assigns box dimensions based on the runs' position and sizes.
     */
    computeNodeBoxes(nodeRuns: Map<LayoutNode, InlineRun[]>): void {
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
    }

    /**
     * Propagate bounding boxes from text nodes to their inline ancestors.
     * This ensures that container nodes (like spans) have a bounding box that encompasses their content,
     * even if they didn't generate box items themselves (e.g. no padding/border).
     */
    propagateBoundingBoxes(nodeRuns: Map<LayoutNode, InlineRun[]>, container: LayoutNode): void {
        // Collect bounding boxes from all nodes with runs
        for (const [node] of nodeRuns.entries()) {
            const rect: BoundingRect = {
                minX: node.box.x,
                minY: node.box.y,
                maxX: node.box.x + node.box.contentWidth,
                maxY: node.box.y + node.box.contentHeight,
            };

            // Propagate upwards to inline ancestors
            let curr = node.parent;
            while (curr && curr !== container && isInlineDisplay(curr.style.display)) {
                this.updateBox(curr, rect);
                curr = curr.parent;
            }
        }

        // Apply computed bounding boxes back to the nodes
        for (const [node, rect] of this.boundingBoxes.entries()) {
            node.box.x = rect.minX;
            node.box.y = rect.minY;
            node.box.contentWidth = rect.maxX - rect.minX;
            node.box.contentHeight = rect.maxY - rect.minY;
            node.box.borderBoxWidth = Math.max(node.box.borderBoxWidth, node.box.contentWidth);
            node.box.borderBoxHeight = Math.max(node.box.borderBoxHeight, node.box.contentHeight);
            node.box.marginBoxWidth = Math.max(node.box.marginBoxWidth, node.box.borderBoxWidth);
            node.box.marginBoxHeight = Math.max(node.box.marginBoxHeight, node.box.borderBoxHeight);
        }
    }

    /**
     * Update or create a bounding box for a node by incorporating a new rectangle.
     * Expands the existing bounding box to include the new rect.
     */
    private updateBox(node: LayoutNode, rect: BoundingRect): void {
        let current = this.boundingBoxes.get(node);
        if (!current) {
            // Seed with existing box if it appears valid (non-zero size), otherwise start with the new rect.
            if (node.box.contentWidth > 0 || node.box.contentHeight > 0) {
                current = {
                    minX: node.box.x,
                    minY: node.box.y,
                    maxX: node.box.x + node.box.contentWidth,
                    maxY: node.box.y + node.box.contentHeight,
                };
                // Union with the new rect
                current.minX = Math.min(current.minX, rect.minX);
                current.minY = Math.min(current.minY, rect.minY);
                current.maxX = Math.max(current.maxX, rect.maxX);
                current.maxY = Math.max(current.maxY, rect.maxY);
            } else {
                current = { ...rect };
            }
            this.boundingBoxes.set(node, current);
        } else {
            current.minX = Math.min(current.minX, rect.minX);
            current.minY = Math.min(current.minY, rect.minY);
            current.maxX = Math.max(current.maxX, rect.maxX);
            current.maxY = Math.max(current.maxY, rect.maxY);
        }
    }
}
