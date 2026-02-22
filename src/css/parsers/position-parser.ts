import { Position } from "../enums.js";
import type { LengthInput } from "../length.js";
import type { StyleAccumulator } from "../style.js";
import { parseLengthOrAuto } from "./length-parser.js";

function parseLengthLike(value: string): LengthInput | undefined {
  return parseLengthOrAuto(value);
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
