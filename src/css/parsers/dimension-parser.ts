import { parseLength, parseLengthOrPercent, parseNumeric, parseClampArgs } from "./length-parser.js";
import type { LengthLike, RelativeLength, ClampNumericLength } from "../length.js";
import type { StyleAccumulator } from "../style.js";
import type { LineHeightInput } from "../line-height.js";

type LengthOrRelative = LengthLike | RelativeLength;

export function parseWidth(value: string, target: StyleAccumulator): void {
  const clampArgs = parseClampArgs(value);
  if (clampArgs) {
    const min = parseLengthOrPercent(clampArgs[0]);
    const preferred = parseLengthOrPercent(clampArgs[1]);
    const max = parseLengthOrPercent(clampArgs[2]);
    if (preferred !== undefined) target.width = preferred;
    if (min !== undefined) target.minWidth ??= min;
    if (max !== undefined) target.maxWidth ??= max;
    return;
  }
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
  const clampArgs = parseClampArgs(value);
  if (clampArgs) {
    const min = parseLengthOrPercent(clampArgs[0]);
    const preferred = parseLengthOrPercent(clampArgs[1]);
    const max = parseLengthOrPercent(clampArgs[2]);
    if (preferred !== undefined) target.height = preferred;
    if (min !== undefined) target.minHeight ??= min;
    if (max !== undefined) target.maxHeight ??= max;
    return;
  }
  const parsed = parseLengthOrPercent(value);
  if (parsed !== undefined) {
    target.height = parsed;
  }
}

export function parseMinHeight(value: string, target: StyleAccumulator): void {
  const parsed = parseLengthOrPercent(value);
  if (parsed !== undefined) {
    target.minHeight = parsed;
  }
}

export function parseMaxHeight(value: string, target: StyleAccumulator): void {
  const parsed = parseLengthOrPercent(value);
  if (parsed !== undefined) {
    target.maxHeight = parsed;
  }
}

export function parseFontSize(value: string, target: StyleAccumulator): void {
  const clampArgs = parseClampArgs(value);
  if (clampArgs) {
    const min = parseLength(clampArgs[0]) ?? parseNumeric(clampArgs[0]);
    const preferred = parseLength(clampArgs[1]) ?? parseNumeric(clampArgs[1]);
    const max = parseLength(clampArgs[2]) ?? parseNumeric(clampArgs[2]);
    if (min !== undefined && preferred !== undefined && max !== undefined) {
      target.fontSize = { kind: "clamp" as const, min, preferred, max };
    }
    return;
  }
  target.fontSize = parseNumeric(value) ?? target.fontSize;
}

function parseLineHeightValue(value: string): LineHeightInput | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const normalized = trimmed.toLowerCase();
  if (normalized === "normal") {
    return { kind: "normal" };
  }
  if (/^[+-]?\d+(?:\.\d+)?%$/.test(normalized)) {
    const numeric = Number.parseFloat(normalized.slice(0, -1));
    if (Number.isNaN(numeric)) {
      return undefined;
    }
    return { kind: "unitless", value: numeric / 100 };
  }
  if (/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    const numeric = Number.parseFloat(normalized);
    if (Number.isNaN(numeric)) {
      return undefined;
    }
    return { kind: "unitless", value: numeric };
  }
  const parsed = parseLength(trimmed);
  if (parsed !== undefined) {
    return { kind: "length", value: parsed };
  }
  return undefined;
}

export function parseLineHeight(value: string, target: StyleAccumulator): void {
  const parsed = parseLineHeightValue(value);
  if (parsed) {
    target.lineHeight = parsed;
  }
}

export function parseZIndex(value: string, target: StyleAccumulator): void {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === "auto") {
    target.zIndex = "auto";
  } else if (/^-?\d+$/.test(trimmed)) {
    target.zIndex = Number.parseInt(trimmed, 10);
  }
}
