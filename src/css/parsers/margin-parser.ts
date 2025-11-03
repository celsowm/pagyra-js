// src/css/parsers/margin-parser.ts

import { applyBoxShorthand } from "../shorthands/box-shorthand.js";
import { parseLength } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";
import type { UnitParsers } from "../../units/units.js";

export function parseMargin(value: string, target: StyleAccumulator): void {
  applyBoxShorthand(value, (top, right, bottom, left) => {
    target.marginTop = top;
    target.marginRight = right;
    target.marginBottom = bottom;
    target.marginLeft = left;
  });
}

export function parseMarginTop(value: string, target: StyleAccumulator): void {
  target.marginTop = parseLength(value) ?? target.marginTop;
}

export function parseMarginRight(value: string, target: StyleAccumulator): void {
  target.marginRight = parseLength(value) ?? target.marginRight;
}

export function parseMarginBottom(value: string, target: StyleAccumulator): void {
  target.marginBottom = parseLength(value) ?? target.marginBottom;
}

export function parseMarginLeft(value: string, target: StyleAccumulator): void {
  target.marginLeft = parseLength(value) ?? target.marginLeft;
}
