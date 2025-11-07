import { parseLength, parseNumeric } from "./length-parser.js";
import { percent } from "../length.js";
import type { LengthLike, RelativeLength } from "../length.js";
import type { StyleAccumulator } from "../style.js";
import type { LineHeightInput } from "../line-height.js";

const PERCENT_LENGTH_REGEX = /^(-?\d+(?:\.\d+)?)%$/;

type LengthOrRelative = LengthLike | RelativeLength;

function parseLengthOrPercent(value: string): LengthOrRelative | undefined {
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
