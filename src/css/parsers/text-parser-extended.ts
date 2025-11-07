// src/css/parsers/text-parser-extended.ts

import { parseTextDecorationLine as parseTextDecorationLineValue } from "./text-parser.js";
import { parseLengthOrPercent } from "./length-parser.js";
import type { StyleAccumulator, TextTransform } from "../style.js";

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

const TEXT_TRANSFORM_KEYWORDS: Record<string, TextTransform> = {
  none: "none",
  uppercase: "uppercase",
  lowercase: "lowercase",
  capitalize: "capitalize",
};

const INHERITABLE_KEYWORDS = new Set(["inherit", "unset", "revert", "revert-layer"]);

export function parseTextTransform(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase();
  if (normalized === "initial") {
    target.textTransform = "none";
    return;
  }
  if (INHERITABLE_KEYWORDS.has(normalized)) {
    return;
  }
  const resolved = TEXT_TRANSFORM_KEYWORDS[normalized];
  if (resolved) {
    target.textTransform = resolved;
  }
}
