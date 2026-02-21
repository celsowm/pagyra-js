import type { LengthLike } from "../length.js";
import { BoxSizing, Display, Position } from "../enums.js";

/**
 * Layout-related CSS properties.
 * Handles positioning, sizing, and display modes.
 */
export interface LayoutProperties {
    /** Display mode (block, inline, flex, grid, etc.) */
    display: Display;

    /** Positioning mode (static, relative, absolute, fixed) */
    position: Position;

    /** Stacking order */
    zIndex: number | "auto";

    /** Box sizing model (content-box or border-box) */
    boxSizing: BoxSizing;

    /** Element width */
    width: LengthLike;

    /** Element height */
    height: LengthLike;

    /** Minimum width constraint */
    minWidth?: LengthLike;

    /** Maximum width constraint */
    maxWidth?: LengthLike;

    /** Minimum height constraint */
    minHeight?: LengthLike;

    /** Maximum height constraint */
    maxHeight?: LengthLike;

    /** Top offset for positioned elements */
    top?: LengthLike;

    /** Right offset for positioned elements */
    right?: LengthLike;

    /** Bottom offset for positioned elements */
    bottom?: LengthLike;

    /** Left offset for positioned elements */
    left?: LengthLike;

    /** Logical inline-start inset (for writing modes) */
    insetInlineStart?: LengthLike;

    /** Logical inline-end inset (for writing modes) */
    insetInlineEnd?: LengthLike;

    /** Logical block-start inset (for writing modes) */
    insetBlockStart?: LengthLike;

    /** Logical block-end inset (for writing modes) */
    insetBlockEnd?: LengthLike;
}
