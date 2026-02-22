// src/css/parsers/margin-block-parser.ts

import { parseLengthOrAuto } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

export function parseMarginBlockStart(value: string, target: StyleAccumulator): void {
  target.marginTop = parseLengthOrAuto(value) ?? target.marginTop;
}

export function parseMarginBlockEnd(value: string, target: StyleAccumulator): void {
  target.marginBottom = parseLengthOrAuto(value) ?? target.marginBottom;
}
