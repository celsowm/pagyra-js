// src/css/parsers/padding-inline-parser.ts

import { parseLength } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

export function parsePaddingInlineStart(value: string, target: StyleAccumulator): void {
  target.paddingLeft = parseLength(value) ?? target.paddingLeft;
}

export function parsePaddingInlineEnd(value: string, target: StyleAccumulator): void {
  target.paddingRight = parseLength(value) ?? target.paddingRight;
}
