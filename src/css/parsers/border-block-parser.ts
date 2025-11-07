// src/css/parsers/border-block-parser.ts

import { applyBorderShorthand } from "../shorthands/border-shorthand.js";
import type { StyleAccumulator } from "../style.js";

export function parseBorderBlockStart(value: string, target: StyleAccumulator): void {
  applyBorderShorthand(value, (width) => {
    target.borderTop = width;
  }, (color) => {
    target.borderColor = color ?? target.borderColor;
  });
}

export function parseBorderBlockEnd(value: string, target: StyleAccumulator): void {
  applyBorderShorthand(value, (width) => {
    target.borderBottom = width;
  }, (color) => {
    target.borderColor = color ?? target.borderColor;
  });
}
