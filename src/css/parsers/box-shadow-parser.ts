// src/css/parsers/box-shadow-parser.ts

import { type BoxShadow } from "../style.js";
import { clampNonNegative, splitCssCommaList, splitCssList } from "../utils.js";
import { parseLength } from "./length-parser.js";

export function parseBoxShadowList(value: string): BoxShadow[] | undefined {
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
  const result: BoxShadow[] = [];
  for (const layer of layers) {
    const parsed = parseSingleBoxShadow(layer);
    if (parsed) {
      result.push(parsed);
    }
  }
  return result;
}

function parseSingleBoxShadow(input: string): BoxShadow | null {
  const tokens = splitCssList(input);
  if (tokens.length === 0) {
    return null;
  }
  let inset = false;
  const lengths: number[] = [];
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

  const offsetX = lengths[0];
  const offsetY = lengths[1];
  const blurRadius = clampNonNegative(lengths[2] ?? 0);
  const spreadRadius = lengths[3] ?? 0;

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
