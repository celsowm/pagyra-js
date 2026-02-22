// src/css/parsers/padding-inline-parser.ts

import { parseLengthOrPercent } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

export function parsePaddingInlineStart(value: string, target: StyleAccumulator): void {
  target.paddingLeft = parseLengthOrPercent(value) ?? target.paddingLeft;
}

export function parsePaddingInlineEnd(value: string, target: StyleAccumulator): void {
  target.paddingRight = parseLengthOrPercent(value) ?? target.paddingRight;
}
