import { parseLength, parseLengthOrPercent, parseNumeric, parseClampArgs } from "./length-parser.js";
import { relativeLength } from "../length.js";
import type { StyleAccumulator } from "../style.js";
import type { LineHeightInput } from "../line-height.js";
import type { ClampNumericLength, RelativeLength } from "../length.js";

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

const FONT_SIZE_KEYWORDS: Readonly<Record<string, number>> = {
  "xx-small": 0.6,
  "x-small": 0.75,
  small: 0.89,
  medium: 1,
  large: 1.2,
  "x-large": 1.5,
  "xx-large": 2,
  "xxx-large": 3,
  smaller: 0.8,
  larger: 1.2,
};

export type FontSizeInput = number | RelativeLength | ClampNumericLength;

export function parseFontSizeValue(value: string): FontSizeInput | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const keywordRatio = FONT_SIZE_KEYWORDS[normalized];
  if (keywordRatio !== undefined) {
    return normalized === "medium" ? 16 : relativeLength("em", keywordRatio);
  }

  const percentMatch = /^([+-]?\d+(?:\.\d+)?)%$/.exec(normalized);
  if (percentMatch) {
    const percentage = Number.parseFloat(percentMatch[1]);
    return percentage >= 0 ? relativeLength("em", percentage / 100) : undefined;
  }

  const clampArgs = parseClampArgs(value);
  if (clampArgs) {
    const min = parseLength(clampArgs[0]) ?? parseNumeric(clampArgs[0]);
    const preferred = parseLength(clampArgs[1]) ?? parseNumeric(clampArgs[1]);
    const max = parseLength(clampArgs[2]) ?? parseNumeric(clampArgs[2]);
    if (min !== undefined && preferred !== undefined && max !== undefined) {
      return { kind: "clamp" as const, min, preferred, max };
    }
    return undefined;
  }

  const parsed = parseNumeric(value);
  if (typeof parsed === "number") {
    return parsed >= 0 ? parsed : undefined;
  }
  if (parsed !== undefined) {
    return parsed.value >= 0 ? parsed : undefined;
  }
  return undefined;
}

export function parseFontSize(value: string, target: StyleAccumulator): void {
  const parsed = parseFontSizeValue(value);
  if (parsed !== undefined) {
    target.fontSize = parsed;
  }
}

export function parseLineHeightValue(value: string): LineHeightInput | undefined {
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
    if (Number.isNaN(numeric) || numeric < 0) {
      return undefined;
    }
    return { kind: "unitless", value: numeric / 100 };
  }
  if (/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    const numeric = Number.parseFloat(normalized);
    if (Number.isNaN(numeric) || numeric < 0) {
      return undefined;
    }
    return { kind: "unitless", value: numeric };
  }
  const parsed = parseLength(trimmed);
  if (parsed !== undefined) {
    if (typeof parsed === "number" && parsed < 0) {
      return undefined;
    }
    if (typeof parsed !== "number" && parsed.value < 0) {
      return undefined;
    }
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
