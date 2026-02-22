import { LayoutNode } from "../../dom/node.js";
import { Display, FloatMode } from "../../css/enums.js";
import { resolveLength } from "../../css/length.js";

/**
 * Resolves the text-align property by walking up the tree to find the first valid value.
 * Returns undefined if no valid value is found.
 */
export function resolveInlineTextAlign(node: LayoutNode): string | undefined {
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

/**
 * Checks if a display mode is an inline-type display.
 */
export function isInlineDisplay(display: Display): boolean {
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

/**
 * Determines if a node should layout its inline children.
 */
export function shouldLayoutInlineChildren(node: LayoutNode): boolean {
    if (node.children.length === 0) {
        return false;
    }
    if (node.style.display !== Display.Inline) {
        return false;
    }
    return true;
}

/**
 * Collects child nodes that participate in inline layout.
 * Filters out nodes with display:none, floated nodes, and non-inline display modes.
 */
export function collectInlineParticipants(node: LayoutNode): LayoutNode[] {
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

/**
 * Calculates the inline extent (start and end positions) of a node within its container.
 * Includes margins, borders, and padding in the calculation.
 */
export function inlineExtentWithinContainer(
    node: LayoutNode,
    referenceWidth: number,
    containerHeight: number = referenceWidth,
): { start: number; end: number } {
    const containerRefs = { containerWidth: referenceWidth, containerHeight };
    const marginLeft = resolveLength(node.style.marginLeft, referenceWidth, { auto: "zero", ...containerRefs });
    const marginRight = resolveLength(node.style.marginRight, referenceWidth, { auto: "zero", ...containerRefs });
    const paddingLeft = resolveLength(node.style.paddingLeft, referenceWidth, { auto: "zero", ...containerRefs });
    const paddingRight = resolveLength(node.style.paddingRight, referenceWidth, { auto: "zero", ...containerRefs });
    const borderLeft = resolveLength(node.style.borderLeft, referenceWidth, { auto: "zero", ...containerRefs });
    const borderRight = resolveLength(node.style.borderRight, referenceWidth, { auto: "zero", ...containerRefs });

    const marginStart = node.box.x - paddingLeft - borderLeft - marginLeft;
    const width =
        node.box.contentWidth + paddingLeft + paddingRight + borderLeft + borderRight + marginLeft + marginRight;

    return {
        start: marginStart,
        end: marginStart + width,
    };
}
