// src/css/parsers/padding-block-parser.ts

import { parseLengthOrPercent } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

export function parsePaddingBlockStart(value: string, target: StyleAccumulator): void {
  target.paddingTop = parseLengthOrPercent(value) ?? target.paddingTop;
}

export function parsePaddingBlockEnd(value: string, target: StyleAccumulator): void {
  target.paddingBottom = parseLengthOrPercent(value) ?? target.paddingBottom;
}
