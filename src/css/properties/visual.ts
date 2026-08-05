import type { NumericLength } from "../length.js";
import type { BackgroundLayer } from "../background-types.js";
import { OverflowMode } from "../enums.js";
import type { ClipPath } from "../clip-path-types.js";

export type Visibility = "visible" | "hidden" | "collapse";

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

export interface NumericFilterFunction {
    kind: "brightness" | "contrast" | "grayscale" | "sepia" | "saturate" | "invert" | "opacity";
    value: number;
}

export interface BlurFilterFunction {
    kind: "blur";
    value: NumericLength;
}

export interface HueRotateFilterFunction {
    kind: "hue-rotate";
    valueDeg: number;
}

export interface DropShadowFilterFunction {
    kind: "drop-shadow";
    offsetX: NumericLength;
    offsetY: NumericLength;
    blurRadius: NumericLength;
    color?: string;
}

export type FilterFunction =
    | NumericFilterFunction
    | BlurFilterFunction
    | HueRotateFilterFunction
    | DropShadowFilterFunction;

/** Visual effects and rendering CSS properties. */
export interface VisualProperties {
    backgroundLayers?: BackgroundLayer[];
    boxShadows: BoxShadow[];
    textShadows: TextShadow[];
    opacity: number;
    visibility: Visibility;
    transform?: string;
    overflowX: OverflowMode;
    overflowY: OverflowMode;
    clipPath?: ClipPath;
    mask?: string;
    filter?: FilterFunction[];
    backdropFilter?: FilterFunction[];
}
