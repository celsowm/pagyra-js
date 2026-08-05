import type { ObjectPosition } from "../properties/misc.js";
import type { StyleAccumulator } from "../style.js";
import { registerPropertyParser } from "./registry.js";

const HORIZONTAL_KEYWORDS: Readonly<Record<string, number>> = {
  left: 0,
  center: 0.5,
  right: 1,
};

const VERTICAL_KEYWORDS: Readonly<Record<string, number>> = {
  top: 0,
  center: 0.5,
  bottom: 1,
};

let registered = false;

export function registerObjectPositionParser(): void {
  if (registered) {
    return;
  }
  registered = true;
  registerPropertyParser("object-position", parseObjectPosition);
}

export function parseObjectPosition(value: string, target: StyleAccumulator): void {
  const parsed = parseObjectPositionValue(value);
  if (parsed) {
    target.objectPosition = parsed;
  }
}

export function parseObjectPositionValue(value: string): ObjectPosition | undefined {
  const tokens = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 2) {
    return undefined;
  }

  if (tokens.length === 1) {
    const token = tokens[0];
    const percentage = parsePercentage(token);
    if (percentage !== undefined) {
      return { x: percentage, y: 0.5 };
    }
    if (token === "top" || token === "bottom") {
      return { x: 0.5, y: VERTICAL_KEYWORDS[token] };
    }
    const horizontal = HORIZONTAL_KEYWORDS[token];
    return horizontal === undefined ? undefined : { x: horizontal, y: 0.5 };
  }

  const [first, second] = tokens;
  const firstPercentage = parsePercentage(first);
  const secondPercentage = parsePercentage(second);
  if (firstPercentage !== undefined && secondPercentage !== undefined) {
    return { x: firstPercentage, y: secondPercentage };
  }

  const firstHorizontal = HORIZONTAL_KEYWORDS[first];
  const firstVertical = VERTICAL_KEYWORDS[first];
  const secondHorizontal = HORIZONTAL_KEYWORDS[second];
  const secondVertical = VERTICAL_KEYWORDS[second];

  if (
    firstHorizontal !== undefined
    && secondVertical !== undefined
    && !(first === "center" && second === "center")
  ) {
    return { x: firstHorizontal, y: secondVertical };
  }
  if (firstVertical !== undefined && secondHorizontal !== undefined) {
    return { x: secondHorizontal, y: firstVertical };
  }

  if (firstPercentage !== undefined && secondVertical !== undefined) {
    return { x: firstPercentage, y: secondVertical };
  }
  if (firstHorizontal !== undefined && secondPercentage !== undefined) {
    return { x: firstHorizontal, y: secondPercentage };
  }

  if (first === "center" && second === "center") {
    return { x: 0.5, y: 0.5 };
  }
  return undefined;
}

function parsePercentage(token: string): number | undefined {
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))%$/.exec(token);
  if (!match) {
    return undefined;
  }
  const value = Number(match[1]) / 100;
  return Number.isFinite(value) ? value : undefined;
}
