// src/css/parsers/margin-inline-parser.ts

import { parseLengthOrAuto } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

export function parseMarginInlineStart(value: string, target: StyleAccumulator): void {
  target.marginLeft = parseLengthOrAuto(value) ?? target.marginLeft;
}

export function parseMarginInlineEnd(value: string, target: StyleAccumulator): void {
  target.marginRight = parseLengthOrAuto(value) ?? target.marginRight;
}
