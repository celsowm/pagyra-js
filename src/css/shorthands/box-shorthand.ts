// src/css/shorthands/box-shorthand.ts

import { parseLength, parseLengthOrAuto } from "../parsers/length-parser.js";
import { splitCssList } from "../utils.js";
import type { RelativeLength } from "../length.js";

type BoxLength = number | RelativeLength | "auto" | undefined;

export function applyBoxShorthand<T extends BoxLength = BoxLength>(
  value: string,
  apply: (
    top: T,
    right: T,
    bottom: T,
    left: T,
  ) => void,
  parser: (input: string) => T = parseLengthOrAuto as unknown as (input: string) => T,
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
  apply(top as T, right as T, bottom as T, left as T);
}
