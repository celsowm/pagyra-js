// src/css/parsers/margin-parser.ts

import { applyBoxShorthand } from "../shorthands/box-shorthand.js";
import { parseLengthOrAuto } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

export function parseMargin(value: string, target: StyleAccumulator): void {
  applyBoxShorthand(value, (top, right, bottom, left) => {
    target.marginTop = top;
    target.marginRight = right;
    target.marginBottom = bottom;
    target.marginLeft = left;
  });
}

export function parseMarginTop(value: string, target: StyleAccumulator): void {
  target.marginTop = parseLengthOrAuto(value) ?? target.marginTop;
}

export function parseMarginRight(value: string, target: StyleAccumulator): void {
  target.marginRight = parseLengthOrAuto(value) ?? target.marginRight;
}

export function parseMarginBottom(value: string, target: StyleAccumulator): void {
  target.marginBottom = parseLengthOrAuto(value) ?? target.marginBottom;
}

export function parseMarginLeft(value: string, target: StyleAccumulator): void {
  target.marginLeft = parseLengthOrAuto(value) ?? target.marginLeft;
}
