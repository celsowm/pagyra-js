import type { NumericLength } from "../length.js";
import type { BackgroundLayer } from "../background-types.js";
import { OverflowMode } from "../enums.js";
import type { ClipPath } from "../clip-path-types.js";

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

// ── Filter function types ──────────────────────────────────────────

/** Funções de filtro com argumento numérico (number ou percentage → number) */
export interface NumericFilterFunction {
    kind: "brightness" | "contrast" | "grayscale" | "sepia" | "saturate" | "invert" | "opacity";
    /** Valor normalizado: percentage já convertido para number (50% → 0.5) */
    value: number;
}

/** blur() usa <length>, não número puro */
export interface BlurFilterFunction {
    kind: "blur";
    /** Raio em px (já resolvido de em/rem via NumericLength) */
    value: NumericLength;
}

/** hue-rotate() usa <angle> */
export interface HueRotateFilterFunction {
    kind: "hue-rotate";
    /** Ângulo normalizado em graus */
    valueDeg: number;
}

/**
 * drop-shadow() — subconjunto de box-shadow:
 * NÃO suporta `inset` nem `spread-radius`.
 * Reutiliza NumericLength para offset/blur para resolução posterior em overrides.ts.
 */
export interface DropShadowFilterFunction {
    kind: "drop-shadow";
    offsetX: NumericLength;
    offsetY: NumericLength;
    blurRadius: NumericLength;
    color?: string;
}

/** União de todas as funções de filtro suportadas */
export type FilterFunction =
    | NumericFilterFunction
    | BlurFilterFunction
    | HueRotateFilterFunction
    | DropShadowFilterFunction;

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

    /** Clipping path applied to the element */
    clipPath?: ClipPath;

    /** CSS filter — lista ordenada de funções (aplicadas da esquerda para direita) */
    filter?: FilterFunction[];

    /** CSS backdrop-filter — mesma estrutura, render diferente */
    backdropFilter?: FilterFunction[];
}
