// src/css/parsers/text-parser-extended.ts

import { parseTextDecorationLine as parseTextDecorationLineValue } from "./text-parser.js";
import { parseLengthOrPercent } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

export function parseTextAlign(value: string, target: StyleAccumulator): void {
  target.textAlign = value.toLowerCase();
}

export function parseTextDecoration(value: string, target: StyleAccumulator): void {
  const parsed = parseTextDecorationLineValue(value);
  if (parsed !== undefined) {
    target.textDecorationLine = parsed;
  }
}

export function parseTextDecorationLine(value: string, target: StyleAccumulator): void {
  const parsed = parseTextDecorationLineValue(value);
  if (parsed !== undefined) {
    target.textDecorationLine = parsed;
  }
}

export function parseFloat(value: string, target: StyleAccumulator): void {
  target.float = value;
}

export function parseTextIndent(value: string, target: StyleAccumulator): void {
  const parsed = parseLengthOrPercent(value);
  if (parsed !== undefined) {
    target.textIndent = parsed;
  }
}
