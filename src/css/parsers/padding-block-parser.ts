// src/css/parsers/padding-block-parser.ts

import { parseLength } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

export function parsePaddingBlockStart(value: string, target: StyleAccumulator): void {
  target.paddingTop = parseLength(value) ?? target.paddingTop;
}

export function parsePaddingBlockEnd(value: string, target: StyleAccumulator): void {
  target.paddingBottom = parseLength(value) ?? target.paddingBottom;
}
