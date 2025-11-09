import { Position } from "../enums.js";
import { percent } from "../length.js";
import type { LengthInput } from "../length.js";
import type { StyleAccumulator } from "../style.js";
import { parseLength } from "./length-parser.js";

const PERCENT_LENGTH_REGEX = /^(-?\d+(?:\.\d+)?)%$/;

function parseLengthLike(value: string): LengthInput | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.toLowerCase() === "auto") {
    return "auto";
  }

  const parsed = parseLength(trimmed);
  if (parsed !== undefined) {
    return parsed;
  }

  const percentMatch = PERCENT_LENGTH_REGEX.exec(trimmed);
  if (percentMatch) {
    const numeric = Number.parseFloat(percentMatch[1]);
    if (!Number.isNaN(numeric)) {
      return percent(numeric / 100);
    }
  }

  return undefined;
}

export function parsePosition(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case Position.Static:
    case Position.Relative:
    case Position.Absolute:
    case Position.Fixed:
    case Position.Sticky:
      target.position = normalized as Position;
      break;
    default:
      break;
  }
}

export function parseTop(value: string, target: StyleAccumulator): void {
  const parsed = parseLengthLike(value);
  if (parsed !== undefined) {
    target.top = parsed;
  }
}

export function parseRight(value: string, target: StyleAccumulator): void {
  const parsed = parseLengthLike(value);
  if (parsed !== undefined) {
    target.right = parsed;
  }
}

export function parseBottom(value: string, target: StyleAccumulator): void {
  const parsed = parseLengthLike(value);
  if (parsed !== undefined) {
    target.bottom = parsed;
  }
}

export function parseLeft(value: string, target: StyleAccumulator): void {
  const parsed = parseLengthLike(value);
  if (parsed !== undefined) {
    target.left = parsed;
  }
}
