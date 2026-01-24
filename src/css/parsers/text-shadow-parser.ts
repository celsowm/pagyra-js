import { type TextShadowInput, type StyleAccumulator } from "../style.js";
import { clampNonNegative, splitCssCommaList, splitCssList } from "../utils.js";
import { parseLength } from "./length-parser.js";
import type { RelativeLength } from "../length.js";

export function parseTextShadowList(value: string): TextShadowInput[] | undefined {
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
  const result: TextShadowInput[] = [];
  for (const layer of layers) {
    const parsed = parseSingleTextShadow(layer);
    if (parsed) {
      result.push(parsed);
    }
  }
  return result;
}

// Wrapper parser used by the declarations registry: assigns parsed value to the style accumulator
export function parseTextShadow(value: string, target: StyleAccumulator): void {
  const parsed = parseTextShadowList(value);
  if (parsed !== undefined) {
    target.textShadows = parsed;
  }
}

function parseSingleTextShadow(input: string): TextShadowInput | null {
  const tokens = splitCssList(input);
  if (tokens.length === 0) {
    return null;
  }

  const lengths = [];
  let color: string | undefined;

  for (const token of tokens) {
    const length = parseLength(token);
    if (length !== undefined) {
      lengths.push(length);
      continue;
    }
    if (color === undefined) {
      // Heuristic for color tokens
      const lowered = token.toLowerCase();
      if (isColorLike(lowered)) {
        color = token;
        continue;
      }
    }
    // ignore unknown tokens
  }

  if (lengths.length < 2) {
    return null;
  }

  const asLength = (value: number | RelativeLength | undefined, clamp = false) => {
    if (value === undefined) return 0;
    if (typeof value === "number" && clamp) {
      return clampNonNegative(value);
    }
    if (typeof value === "number") return value;
    return value;
  };

  const offsetX = asLength(lengths[0]);
  const offsetY = asLength(lengths[1]);
  const blurRadius = asLength(lengths[2], true);

  return {
    offsetX,
    offsetY,
    blurRadius,
    color,
  };
}

function isColorLike(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("#") || value.startsWith("rgb(") || value.startsWith("rgba(") || value.startsWith("hsl(") || value.startsWith("hsla(")) {
    return true;
  }
  const colorNames = ['transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'gray', 'grey'];
  return colorNames.includes(value.toLowerCase());
}
