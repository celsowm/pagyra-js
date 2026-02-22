import { LayoutNode } from "../../dom/node.js";
import { Display } from "../../css/enums.js";
import { resolveLength } from "../../css/length.js";
import { inFlow } from "./node-math.js";

type LayoutDebug = (...args: unknown[]) => void;

/**
 * Handles measurement and adjustment of intrinsic content width for layout nodes.
 * 
 * This class is responsible for:
 * - Measuring the actual width used by in-flow children
 * - Calculating offsets for content alignment
 * - Shifting children horizontally when needed
 * 
 * Primarily used for inline-block sizing where the content width
 * needs to shrink-to-fit based on children's actual space usage.
 */
export class ContentMeasurer {
    constructor(private readonly layoutDebug: LayoutDebug) {}
    /**
     * Measures the intrinsic width of in-flow content within a node.
     * 
     * Calculates the minimum and maximum horizontal extents of all in-flow
     * children, taking into account their margins, borders, and padding.
     * 
     * @param node - The parent node whose content width to measure
     * @param referenceWidth - The reference width for percentage calculations
     * @param contentStartX - The X coordinate where content area begins
     * @returns Object containing the measured width and any left offset
     */
    measureInFlowWidth(
        node: LayoutNode,
        referenceWidth: number,
        contentStartX: number,
        containerHeight: number = referenceWidth,
    ): { width: number; leftOffset: number } {
        const containerRefs = { containerWidth: referenceWidth, containerHeight };
        let minStart = Number.POSITIVE_INFINITY;
        let maxEnd = Number.NEGATIVE_INFINITY;
        let hasContent = false;

        for (const child of node.children) {
            if (!inFlow(child)) {
                continue;
            }
            if (child.style.display === Display.None) {
                continue;
            }

            const marginLeft =
                child.box.usedMarginLeft !== undefined
                    ? child.box.usedMarginLeft
                    : resolveLength(child.style.marginLeft, referenceWidth, { auto: "zero", ...containerRefs });
            const marginRight =
                child.box.usedMarginRight !== undefined
                    ? child.box.usedMarginRight
                    : resolveLength(child.style.marginRight, referenceWidth, { auto: "zero", ...containerRefs });
            const borderLeft = resolveLength(child.style.borderLeft, referenceWidth, { auto: "zero", ...containerRefs });
            const borderRight = resolveLength(child.style.borderRight, referenceWidth, { auto: "zero", ...containerRefs });
            const paddingLeft = resolveLength(child.style.paddingLeft, referenceWidth, { auto: "zero", ...containerRefs });
            const paddingRight = resolveLength(child.style.paddingRight, referenceWidth, { auto: "zero", ...containerRefs });

            const borderBoxWidth = child.box.borderBoxWidth || Math.max(0, child.box.contentWidth + paddingLeft + paddingRight + borderLeft + borderRight);
            const marginBoxWidth = borderBoxWidth + marginLeft + marginRight;
            const marginStart = child.box.x - paddingLeft - borderLeft - marginLeft;
            const relativeStart = marginStart - contentStartX;
            const relativeEnd = relativeStart + marginBoxWidth;

            this.layoutDebug(
                `[measureInFlowContentWidth] parent=${node.tagName ?? "(anonymous)"} child=${child.tagName ?? "(anonymous)"} marginStart=${marginStart} relativeStart=${relativeStart} marginBoxWidth=${marginBoxWidth} borderBoxWidth=${borderBoxWidth} child.box.x=${child.box.x} contentStartX=${contentStartX}`,
            );

            minStart = Math.min(minStart, relativeStart);
            maxEnd = Math.max(maxEnd, relativeEnd);
            hasContent = true;
        }

        if (!hasContent) {
            return { width: 0, leftOffset: 0 };
        }

        if (!Number.isFinite(minStart)) {
            minStart = 0;
        }
        if (!Number.isFinite(maxEnd)) {
            maxEnd = minStart;
        }

        const width = Math.max(0, maxEnd - minStart);
        const leftOffset = minStart > 0 ? minStart : 0;
        return { width, leftOffset };
    }

    /**
     * Shifts all in-flow children horizontally by the specified amount.
     * 
     * This is used to adjust child positions when the parent's content width
     * changes (e.g., for inline-block shrink-to-fit).
     * 
     * @param node - The parent node whose children to shift
     * @param deltaX - The horizontal offset to apply (negative shifts left)
     */
    shiftInFlowChildrenX(node: LayoutNode, deltaX: number): void {
        if (deltaX === 0) {
            return;
        }
        for (const child of node.children) {
            if (!inFlow(child)) {
                continue;
            }
            if (child.style.display === Display.None) {
                continue;
            }
            // Shift the child and all its descendants
            child.shift(-deltaX, 0);
        }
    }
}
