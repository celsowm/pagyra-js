import { LayoutNode } from "../../dom/node.js";
import { Display } from "../../css/enums.js";

/**
 * Determines if a layout node has an inline-level display mode.
 * 
 * Inline-level elements participate in inline formatting contexts
 * and can be laid out on the same line with text and other inline elements.
 * 
 * @param node - The layout node to check
 * @returns true if the node has an inline-level display mode
 */
export function isInlineLevel(node: LayoutNode): boolean {
    switch (node.style.display) {
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
