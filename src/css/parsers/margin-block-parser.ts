// src/css/parsers/margin-block-parser.ts

import { parseLength } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

export function parseMarginBlockStart(value: string, target: StyleAccumulator): void {
  target.marginTop = parseLength(value) ?? target.marginTop;
}

export function parseMarginBlockEnd(value: string, target: StyleAccumulator): void {
  target.marginBottom = parseLength(value) ?? target.marginBottom;
}
