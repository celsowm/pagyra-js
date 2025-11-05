import { parseLength, parseNumeric } from "./length-parser.js";
import { percent } from "../length.js";
import type { LengthLike } from "../length.js";
import type { StyleAccumulator } from "../style.js";

const PERCENT_LENGTH_REGEX = /^(-?\d+(?:\.\d+)?)%$/;

function parseLengthOrPercent(value: string): LengthLike | undefined {
  const parsed = parseLength(value);
  if (parsed !== undefined) {
    return parsed;
  }
  const match = PERCENT_LENGTH_REGEX.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const numeric = Number.parseFloat(match[1]);
  if (Number.isNaN(numeric)) {
    return undefined;
  }
  return percent(numeric / 100);
}

export function parseWidth(value: string, target: StyleAccumulator): void {
  const parsed = parseLengthOrPercent(value);
  if (parsed !== undefined) {
    target.width = parsed;
  }
}

export function parseMinWidth(value: string, target: StyleAccumulator): void {
  const parsed = parseLengthOrPercent(value);
  if (parsed !== undefined) {
    target.minWidth = parsed;
  }
}

export function parseMaxWidth(value: string, target: StyleAccumulator): void {
  const parsed = parseLengthOrPercent(value);
  if (parsed !== undefined) {
    target.maxWidth = parsed;
  }
}

export function parseHeight(value: string, target: StyleAccumulator): void {
  target.height = parseLength(value) ?? target.height;
}

export function parseMinHeight(value: string, target: StyleAccumulator): void {
  target.minHeight = parseLength(value) ?? target.minHeight;
}

export function parseMaxHeight(value: string, target: StyleAccumulator): void {
  target.maxHeight = parseLength(value) ?? target.maxHeight;
}

export function parseFontSize(value: string, target: StyleAccumulator): void {
  target.fontSize = parseNumeric(value) ?? target.fontSize;
}

export function parseLineHeight(value: string, target: StyleAccumulator): void {
  target.lineHeight = parseLength(value);
}

export function parseZIndex(value: string, target: StyleAccumulator): void {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === "auto") {
    target.zIndex = "auto";
  } else if (/^[+-]?\d+$/.test(trimmed)) {
    target.zIndex = Number.parseInt(trimmed, 10);
  }
}

export function parseOpacity(value: string, target: StyleAccumulator): void {
  const num = Number.parseFloat(value.trim());
  if (Number.isFinite(num)) {
    target.opacity = Math.max(0, Math.min(1, num));
  }
}
