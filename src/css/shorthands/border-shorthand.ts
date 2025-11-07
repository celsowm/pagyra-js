// src/css/shorthands/border-shorthand.ts

import { DEFAULT_BORDER_WIDTH, parseBorderShorthand } from "../parsers/border-parser.js";
import { splitCssList } from "../utils.js";
import type { NumericLength } from "../style.js";

export function applyBorderShorthand(
  value: string,
  applyWidth: (width: NumericLength) => void,
  applyColor: (color: string | undefined) => void,
): void {
  const parsed = parseBorderShorthand(value);
  if (!parsed) {
    return;
  }

  if (parsed.style === "none" || parsed.style === "hidden") {
    applyWidth(0);
  } else if (parsed.width !== undefined) {
    applyWidth(parsed.width);
  } else if (parsed.style) {
    applyWidth(DEFAULT_BORDER_WIDTH);
  }

  if (parsed.color !== undefined) {
    applyColor(parsed.color);
  }
}

export function applyBorderColorShorthand(value: string, applyColor: (color: string) => void): void {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return;
  }
  const [top] =
    parts.length === 1
      ? [parts[0], parts[0], parts[0], parts[0]]
      : parts.length === 2
        ? [parts[0], parts[1], parts[0], parts[1]]
        : parts.length === 3
          ? [parts[0], parts[1], parts[2], parts[1]]
          : [parts[0], parts[1], parts[2], parts[3]];
  if (top) {
    applyColor(top);
  }
}

export function applyBorderStyleShorthand(value: string, apply: (style: string | undefined) => void): void {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return;
  }
  apply(parts[0]?.toLowerCase());
}

export function isNoneBorderStyle(value: string): boolean {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return false;
  }
  const keyword = parts[0]?.toLowerCase();
  return keyword === "none" || keyword === "hidden";
}
