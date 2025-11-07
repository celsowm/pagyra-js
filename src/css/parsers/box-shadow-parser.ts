// src/css/parsers/box-shadow-parser.ts

import { type BoxShadowInput, type NumericLength } from "../style.js";
import { clampNonNegative, splitCssCommaList, splitCssList } from "../utils.js";
import { parseLength } from "./length-parser.js";

export function parseBoxShadowList(value: string): BoxShadowInput[] | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const keyword = trimmed.toLowerCase();
  if (keyword === "none" || keyword === "initial") {
    return [];
  }
  if (keyword === "inherit" || keyword === "revert" || keyword === "revert-layer") {
    return undefined;
  }
  const layers = splitCssCommaList(trimmed);
  const result: BoxShadowInput[] = [];
  for (const layer of layers) {
    const parsed = parseSingleBoxShadow(layer);
    if (parsed) {
      result.push(parsed);
    }
  }
  return result;
}

function parseSingleBoxShadow(input: string): BoxShadowInput | null {
  const tokens = splitCssList(input);
  if (tokens.length === 0) {
    return null;
  }
  let inset = false;
  const lengths: NumericLength[] = [];
  let color: string | undefined;

  for (const token of tokens) {
    const lowered = token.toLowerCase();
    if (lowered === "inset") {
      inset = true;
      continue;
    }
    const length = parseLength(token);
    if (length !== undefined) {
      lengths.push(length);
      continue;
    }
    if (color === undefined) {
      // Check if this looks like a color
      if (isColorLike(token)) {
        color = token;
        continue;
      }
    }
    // Ignore unknown tokens instead of failing
    continue;
  }

  if (lengths.length < 2) {
    return null;
  }

  const asLength = (value: NumericLength | undefined, clamp = false): NumericLength => {
    if (value === undefined) {
      return 0;
    }
    if (typeof value === "number" && clamp) {
      return clampNonNegative(value);
    }
    if (typeof value === "number") {
      return value;
    }
    return value;
  };

  const offsetX = asLength(lengths[0]);
  const offsetY = asLength(lengths[1]);
  const blurRadius = asLength(lengths[2], true);
  const spreadRadius = asLength(lengths[3]);

  return {
    inset,
    offsetX,
    offsetY,
    blurRadius,
    spreadRadius,
    color,
  };
}

function isColorLike(value: string): boolean {
  const lowerValue = value.toLowerCase();
  // Basic color detection
  if (lowerValue.startsWith('#') ||
      lowerValue.startsWith('rgb(') ||
      lowerValue.startsWith('rgba(') ||
      lowerValue.startsWith('hsl(') ||
      lowerValue.startsWith('hsla(')) {
    return true;
  }
  // Common color names
  const colorNames = ['transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'gray', 'grey'];
  return colorNames.includes(lowerValue);
}
