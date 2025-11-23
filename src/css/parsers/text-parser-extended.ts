// src/css/parsers/text-parser-extended.ts

import { parseTextDecorationLine as parseTextDecorationLineValue } from "./text-parser.js";
import { parseLengthOrPercent, parseNumeric } from "./length-parser.js";
import type { StyleAccumulator, TextTransform } from "../style.js";
import { NAMED_COLORS } from "../named-colors.js";

export function parseTextAlign(value: string, target: StyleAccumulator): void {
  target.textAlign = value.toLowerCase();
}

export function parseTextDecoration(value: string, target: StyleAccumulator): void {
  const parsed = parseTextDecorationLineValue(value);
  if (parsed !== undefined) {
    target.textDecorationLine = parsed;
  }
  const style = extractTextDecorationStyle(value);
  if (style) {
    target.textDecorationStyle = style;
  }
  const color = extractTextDecorationColor(value);
  if (color) {
    target.textDecorationColor = color;
  }
}

export function parseTextDecorationLine(value: string, target: StyleAccumulator): void {
  const parsed = parseTextDecorationLineValue(value);
  if (parsed !== undefined) {
    target.textDecorationLine = parsed;
  }
}

export function parseTextDecorationColor(value: string, target: StyleAccumulator): void {
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }
  target.textDecorationColor = trimmed;
}

export function parseTextDecorationStyle(value: string, target: StyleAccumulator): void {
  const style = extractTextDecorationStyle(value);
  if (style) {
    target.textDecorationStyle = style;
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

export function parseLetterSpacing(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return;
  }
  if (normalized === "normal") {
    target.letterSpacing = 0;
    return;
  }
  if (INHERITABLE_KEYWORDS.has(normalized)) {
    return;
  }
  const parsed = parseNumeric(value);
  if (parsed !== undefined) {
    target.letterSpacing = parsed;
  }
}

const TEXT_TRANSFORM_KEYWORDS: Record<string, TextTransform> = {
  none: "none",
  uppercase: "uppercase",
  lowercase: "lowercase",
  capitalize: "capitalize",
};

const INHERITABLE_KEYWORDS = new Set(["inherit", "unset", "revert", "revert-layer"]);

const COLOR_KEYWORDS = new Set(Object.keys(NAMED_COLORS).map((name) => name.toLowerCase()));
COLOR_KEYWORDS.add("transparent");
COLOR_KEYWORDS.add("currentcolor");
const DECORATION_LINE_KEYWORDS = new Set(["underline", "overline", "line-through", "none"]);
const DECORATION_STYLE_KEYWORDS = new Set(["solid", "double", "dotted", "dashed", "wavy"]);

function extractTextDecorationStyle(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const tokens = value.trim().toLowerCase().split(/\s+/);
  for (const token of tokens) {
    if (DECORATION_STYLE_KEYWORDS.has(token)) {
      return token;
    }
  }
  return undefined;
}

function extractTextDecorationColor(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const functionalMatch = value.match(/\b(?:rgba?|hsla?)\([^)]*\)/i);
  if (functionalMatch) {
    return functionalMatch[0].trim();
  }
  const hexMatch = value.match(/#[0-9a-f]{3,8}\b/i);
  if (hexMatch) {
    return hexMatch[0];
  }
  const tokens = value.trim().split(/\s+/);
  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (DECORATION_LINE_KEYWORDS.has(normalized)) {
      continue;
    }
    if (COLOR_KEYWORDS.has(normalized)) {
      return normalized;
    }
  }
  return undefined;
}
