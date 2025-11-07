// src/css/parsers/margin-inline-parser.ts

import { parseLength } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

export function parseMarginInlineStart(value: string, target: StyleAccumulator): void {
  target.marginLeft = parseLength(value) ?? target.marginLeft;
}

export function parseMarginInlineEnd(value: string, target: StyleAccumulator): void {
  target.marginRight = parseLength(value) ?? target.marginRight;
}
