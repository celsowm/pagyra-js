// src/css/parsers/border-inline-parser.ts

import { applyBorderShorthand } from "../shorthands/border-shorthand.js";
import type { StyleAccumulator } from "../style.js";

export function parseBorderInlineStart(value: string, target: StyleAccumulator): void {
  applyBorderShorthand(value, (width) => {
    target.borderLeft = width;
  }, (color) => {
    target.borderColor = color ?? target.borderColor;
  });
}

export function parseBorderInlineEnd(value: string, target: StyleAccumulator): void {
  applyBorderShorthand(value, (width) => {
    target.borderRight = width;
  }, (color) => {
    target.borderColor = color ?? target.borderColor;
  });
}
