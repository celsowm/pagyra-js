// src/css/parsers/display-flex-parser.ts

import {
  mapAlignContentValue,
  mapAlignItemsValue,
  mapAlignSelfValue,
  mapDisplay,
  mapJustifyContent,
  parseFlexDirectionValue,
} from "./flex-parser.js";
import { parseLengthOrAuto } from "./length-parser.js";
import type { StyleAccumulator } from "../style.js";

function parseNonNegativeNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return undefined;
  }
  const parsed = Number.parseFloat(trimmed);
  if (Number.isNaN(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

export function parseDisplay(value: string, target: StyleAccumulator): void {
  target.display = mapDisplay(value);
}

export function parseJustifyContent(value: string, target: StyleAccumulator): void {
  const mapped = mapJustifyContent(value);
  if (mapped !== undefined) {
    target.justifyContent = mapped;
  }
}

export function parseAlignItems(value: string, target: StyleAccumulator): void {
  const mapped = mapAlignItemsValue(value);
  if (mapped !== undefined) {
    target.alignItems = mapped;
  }
}

export function parseAlignContent(value: string, target: StyleAccumulator): void {
  const mapped = mapAlignContentValue(value);
  if (mapped !== undefined) {
    target.alignContent = mapped;
  }
}

export function parseAlignSelf(value: string, target: StyleAccumulator): void {
  const mapped = mapAlignSelfValue(value);
  if (mapped !== undefined) {
    target.alignSelf = mapped;
  }
}

export function parseFlexDirection(value: string, target: StyleAccumulator): void {
  const mapped = parseFlexDirectionValue(value);
  if (mapped !== undefined) {
    target.flexDirection = mapped;
  }
}

export function parseFlexWrap(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase();
  if (normalized === "nowrap") {
    target.flexWrap = false;
  } else if (normalized === "wrap" || normalized === "wrap-reverse") {
    target.flexWrap = true;
  }
}

export function parseFlexGrow(value: string, target: StyleAccumulator): void {
  const parsed = parseNonNegativeNumber(value);
  if (parsed !== undefined) {
    target.flexGrow = parsed;
  }
}

export function parseFlexShrink(value: string, target: StyleAccumulator): void {
  const parsed = parseNonNegativeNumber(value);
  if (parsed !== undefined) {
    target.flexShrink = parsed;
  }
}

export function parseFlexBasis(value: string, target: StyleAccumulator): void {
  const parsed = parseLengthOrAuto(value);
  if (parsed !== undefined) {
    target.flexBasis = parsed;
  }
}

export function parseFlex(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return;
  }
  if (normalized === "none") {
    target.flexGrow = 0;
    target.flexShrink = 0;
    target.flexBasis = "auto";
    return;
  }
  if (normalized === "auto") {
    target.flexGrow = 1;
    target.flexShrink = 1;
    target.flexBasis = "auto";
    return;
  }
  if (normalized === "initial") {
    target.flexGrow = 0;
    target.flexShrink = 1;
    target.flexBasis = "auto";
    return;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return;
  }

  const firstNumber = parseNonNegativeNumber(tokens[0]);
  const firstBasis = parseLengthOrAuto(tokens[0]);

  if (tokens.length === 1) {
    if (firstNumber !== undefined) {
      target.flexGrow = firstNumber;
      target.flexShrink = 1;
      target.flexBasis = 0;
      return;
    }
    if (firstBasis !== undefined) {
      target.flexGrow = 1;
      target.flexShrink = 1;
      target.flexBasis = firstBasis;
    }
    return;
  }

  const secondNumber = parseNonNegativeNumber(tokens[1]);
  const secondBasis = parseLengthOrAuto(tokens[1]);

  if (tokens.length === 2 && firstNumber !== undefined) {
    target.flexGrow = firstNumber;
    if (secondNumber !== undefined) {
      target.flexShrink = secondNumber;
      target.flexBasis = 0;
      return;
    }
    if (secondBasis !== undefined) {
      target.flexShrink = 1;
      target.flexBasis = secondBasis;
    }
    return;
  }

  if (tokens.length >= 3 && firstNumber !== undefined && secondNumber !== undefined) {
    const thirdBasis = parseLengthOrAuto(tokens[2]);
    if (thirdBasis !== undefined) {
      target.flexGrow = firstNumber;
      target.flexShrink = secondNumber;
      target.flexBasis = thirdBasis;
    }
  }
}
