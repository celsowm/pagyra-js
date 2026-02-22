// src/css/parsers/padding-parser.ts

import { applyBoxShorthand } from "../shorthands/box-shorthand.js";
import { parseLengthOrPercent } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

export function parsePadding(value: string, target: StyleAccumulator): void {
  applyBoxShorthand(value, (top, right, bottom, left) => {
    target.paddingTop = top;
    target.paddingRight = right;
    target.paddingBottom = bottom;
    target.paddingLeft = left;
  }, parseLengthOrPercent);
}

export function parsePaddingTop(value: string, target: StyleAccumulator): void {
  target.paddingTop = parseLengthOrPercent(value) ?? target.paddingTop;
}

export function parsePaddingRight(value: string, target: StyleAccumulator): void {
  target.paddingRight = parseLengthOrPercent(value) ?? target.paddingRight;
}

export function parsePaddingBottom(value: string, target: StyleAccumulator): void {
  target.paddingBottom = parseLengthOrPercent(value) ?? target.paddingBottom;
}

export function parsePaddingLeft(value: string, target: StyleAccumulator): void {
  target.paddingLeft = parseLengthOrPercent(value) ?? target.paddingLeft;
}
