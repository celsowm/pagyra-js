import type { NumericLength } from "../length.js";
import type { BackgroundLayer } from "../background-types.js";
import { OverflowMode } from "../enums.js";

// Box shadow types
export interface BoxShadow {
    inset: boolean;
    offsetX: number;
    offsetY: number;
    blurRadius: number;
    spreadRadius: number;
    color?: string;
}

export interface BoxShadowInput {
    inset: boolean;
    offsetX: NumericLength;
    offsetY: NumericLength;
    blurRadius: NumericLength;
    spreadRadius: NumericLength;
    color?: string;
}

// Text shadow types
export interface TextShadow {
    offsetX: number;
    offsetY: number;
    blurRadius: number;
    color?: string;
}

export interface TextShadowInput {
    offsetX: NumericLength;
    offsetY: NumericLength;
    blurRadius?: NumericLength;
    color?: string;
}

/**
 * Visual effects and rendering CSS properties.
 * Handles backgrounds, shadows, opacity, transforms, and overflow.
 */
export interface VisualProperties {
    /** Background layers (colors, images, gradients) */
    backgroundLayers?: BackgroundLayer[];

    /** Box shadows */
    boxShadows: BoxShadow[];

    /** Text shadows */
    textShadows: TextShadow[];

    /** Element opacity (0-1) */
    opacity: number;

    /** CSS transform */
    transform?: string;

    /** Horizontal overflow behavior */
    overflowX: OverflowMode;

    /** Vertical overflow behavior */
    overflowY: OverflowMode;
}
