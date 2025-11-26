import type { LengthLike } from "../length.js";

/**
 * Box model CSS properties.
 * Handles margins, padding, borders, and border radius.
 */
export interface BoxModelProperties {
    /** Margin top */
    marginTop: LengthLike;

    /** Margin right */
    marginRight: LengthLike;

    /** Margin bottom */
    marginBottom: LengthLike;

    /** Margin left */
    marginLeft: LengthLike;

    /** Padding top */
    paddingTop: LengthLike;

    /** Padding right */
    paddingRight: LengthLike;

    /** Padding bottom */
    paddingBottom: LengthLike;

    /** Padding left */
    paddingLeft: LengthLike;

    /** Border width top */
    borderTop: LengthLike;

    /** Border width right */
    borderRight: LengthLike;

    /** Border width bottom */
    borderBottom: LengthLike;

    /** Border width left */
    borderLeft: LengthLike;

    /** Top-left corner horizontal radius */
    borderTopLeftRadiusX: number;

    /** Top-left corner vertical radius */
    borderTopLeftRadiusY: number;

    /** Top-right corner horizontal radius */
    borderTopRightRadiusX: number;

    /** Top-right corner vertical radius */
    borderTopRightRadiusY: number;

    /** Bottom-right corner horizontal radius */
    borderBottomRightRadiusX: number;

    /** Bottom-right corner vertical radius */
    borderBottomRightRadiusY: number;

    /** Bottom-left corner horizontal radius */
    borderBottomLeftRadiusX: number;

    /** Bottom-left corner vertical radius */
    borderBottomLeftRadiusY: number;

    /** Border style top (solid, dashed, etc.) */
    borderStyleTop?: string;

    /** Border style right */
    borderStyleRight?: string;

    /** Border style bottom */
    borderStyleBottom?: string;

    /** Border style left */
    borderStyleLeft?: string;

    /** Border color (applies to all sides) */
    borderColor?: string;
}
