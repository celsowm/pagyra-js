// src/css/parsers/padding-parser.ts

import { applyBoxShorthand } from "../shorthands/box-shorthand.js";
import { parseLength } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

export function parsePadding(value: string, target: StyleAccumulator): void {
  applyBoxShorthand(value, (top, right, bottom, left) => {
    target.paddingTop = top;
    target.paddingRight = right;
    target.paddingBottom = bottom;
    target.paddingLeft = left;
  }, parseLength);
}

export function parsePaddingTop(value: string, target: StyleAccumulator): void {
  target.paddingTop = parseLength(value) ?? target.paddingTop;
}

export function parsePaddingRight(value: string, target: StyleAccumulator): void {
  target.paddingRight = parseLength(value) ?? target.paddingRight;
}

export function parsePaddingBottom(value: string, target: StyleAccumulator): void {
  target.paddingBottom = parseLength(value) ?? target.paddingBottom;
}

export function parsePaddingLeft(value: string, target: StyleAccumulator): void {
  target.paddingLeft = parseLength(value) ?? target.paddingLeft;
}
