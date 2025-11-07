// src/css/shorthands/box-shorthand.ts

import { parseLength } from "../parsers/length-parser.js";
import { splitCssList } from "../utils.js";
import type { RelativeLength } from "../length.js";

export function applyBoxShorthand(
  value: string,
  apply: (
    top: number | RelativeLength | undefined,
    right: number | RelativeLength | undefined,
    bottom: number | RelativeLength | undefined,
    left: number | RelativeLength | undefined,
  ) => void,
  parser: (input: string) => number | RelativeLength | undefined = parseLength,
): void {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return;
  }
  const resolved = parts.map((part) => parser(part));
  const [top, right, bottom, left] =
    resolved.length === 1
      ? [resolved[0], resolved[0], resolved[0], resolved[0]]
      : resolved.length === 2
        ? [resolved[0], resolved[1], resolved[0], resolved[1]]
        : resolved.length === 3
          ? [resolved[0], resolved[1], resolved[2], resolved[1]]
          : [resolved[0], resolved[1], resolved[2], resolved[3]];
  apply(top, right, bottom, left);
}
