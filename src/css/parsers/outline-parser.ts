import type { OutlineStyle, StyleAccumulator } from "../style.js";
import type { UnitParsers } from "../../units/units.js";
import { registerPropertyParser } from "./registry.js";

const STYLES = new Set<OutlineStyle>(["none", "solid", "dashed", "dotted", "double"]);
const WIDTH_KEYWORDS: Readonly<Record<string, number>> = {
  thin: 1,
  medium: 3,
  thick: 5,
};

let registered = false;

export function registerOutlineParsers(): void {
  if (registered) {
    return;
  }
  registered = true;
  registerPropertyParser("outline", parseOutline);
  registerPropertyParser("outline-width", parseOutlineWidth);
  registerPropertyParser("outline-style", parseOutlineStyle);
  registerPropertyParser("outline-color", parseOutlineColor);
  registerPropertyParser("outline-offset", parseOutlineOffset);
}

export function parseOutline(value: string, target: StyleAccumulator, units: UnitParsers): void {
  const tokens = splitCssTokens(value);
  if (tokens.length === 0) {
    return;
  }

  let width: number | undefined;
  let style: OutlineStyle | undefined;
  const colorTokens: string[] = [];

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    const parsedStyle = STYLES.has(normalized as OutlineStyle)
      ? normalized as OutlineStyle
      : undefined;
    if (parsedStyle && style === undefined) {
      style = parsedStyle;
      continue;
    }

    const parsedWidth = resolveWidth(token, units);
    if (parsedWidth !== undefined && width === undefined) {
      width = parsedWidth;
      continue;
    }
    colorTokens.push(token);
  }

  if (colorTokens.length > 1) {
    return;
  }

  target.outlineWidth = width ?? 3;
  target.outlineStyle = style ?? "none";
  target.outlineColor = colorTokens[0] ?? "currentcolor";
}

export function parseOutlineWidth(value: string, target: StyleAccumulator, units: UnitParsers): void {
  const width = resolveWidth(value.trim(), units);
  if (width !== undefined) {
    target.outlineWidth = width;
  }
}

export function parseOutlineStyle(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase() as OutlineStyle;
  if (STYLES.has(normalized)) {
    target.outlineStyle = normalized;
  }
}

export function parseOutlineColor(value: string, target: StyleAccumulator): void {
  const normalized = value.trim();
  if (normalized) {
    target.outlineColor = normalized;
  }
}

export function parseOutlineOffset(value: string, target: StyleAccumulator, units: UnitParsers): void {
  const parsed = units.parseLength(value.trim());
  if (typeof parsed === "number" && Number.isFinite(parsed)) {
    target.outlineOffset = parsed;
  }
}

function resolveWidth(value: string, units: UnitParsers): number | undefined {
  const keyword = WIDTH_KEYWORDS[value.toLowerCase()];
  if (keyword !== undefined) {
    return keyword;
  }
  const parsed = units.parseLength(value);
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : undefined;
}

function splitCssTokens(value: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  let quote: "\"" | "'" | null = null;

  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (quote) {
      current += character;
      if (character === quote && value[index - 1] !== "\\") {
        quote = null;
      }
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(") {
      depth++;
      current += character;
      continue;
    }
    if (character === ")") {
      depth = Math.max(0, depth - 1);
      current += character;
      continue;
    }
    if (/\s/.test(character) && depth === 0) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += character;
  }

  if (current) {
    tokens.push(current);
  }
  return tokens;
}
