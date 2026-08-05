// src/css/parsers/font-parser.ts

import { parseFontWeightValue } from "../font-weight.js";
import type { StyleAccumulator } from "../style.js";
import type { UnitParsers } from "../../units/units.js";
import { parseFontVariantNumeric as cssParseFontVariantNumeric } from "../properties/typography.js";
import { parseFontSizeValue, parseLineHeightValue } from "./dimension-parser.js";

export function parseFontVariant(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase();
  if (normalized === "inherit") {
    return;
  }

  if (normalized === "normal" || normalized === "small-caps") {
    target.fontVariant = normalized;
  }
}

export function parseFontVariantNumeric(value: string, target: StyleAccumulator): void {
  target.fontVariantNumeric = cssParseFontVariantNumeric(value);
}

export function parseFontStyle(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase();
  if (normalized === "inherit") {
    // Let inheritance fall back to parent; no override needed.
    return;
  }

  if (normalized === "normal" || normalized === "italic" || normalized === "oblique" || normalized.startsWith("oblique ")) {
    target.fontStyle = normalized.startsWith("oblique") ? "oblique" : normalized;
  }
}

export function parseFontWeight(value: string, target: StyleAccumulator, _units: UnitParsers, inheritedFontWeight?: number): void {
  const parsed = parseFontWeightValue(value, inheritedFontWeight);
  if (parsed !== undefined) {
    target.fontWeight = parsed;
  }
}

export function parseFontFamily(value: string, target: StyleAccumulator): void {
  const trimmed = value.trim();
  if (trimmed) {
    target.fontFamily = trimmed;
  }
}

interface ParsedFontShorthand {
  fontStyle: string;
  fontVariant: string;
  fontWeight: number;
  fontSize: NonNullable<StyleAccumulator["fontSize"]>;
  lineHeight: NonNullable<StyleAccumulator["lineHeight"]>;
  fontFamily: string;
}

const FONT_STYLE_KEYWORDS = new Set(["italic", "oblique"]);
const FONT_VARIANT_KEYWORDS = new Set(["small-caps"]);
const FONT_STRETCH_KEYWORDS = new Set([
  "ultra-condensed",
  "extra-condensed",
  "condensed",
  "semi-condensed",
  "semi-expanded",
  "expanded",
  "extra-expanded",
  "ultra-expanded",
]);
const ANGLE_TOKEN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:deg|grad|rad|turn)$/i;

/**
 * Parses the CSS font shorthand supported by Pagyra:
 * [font-style || font-variant || font-weight] font-size [/ line-height] font-family.
 *
 * The shorthand also resets omitted supported longhands to their initial values,
 * matching the CSS cascade behavior of browser engines.
 */
export function parseFont(
  value: string,
  target: StyleAccumulator,
  _units: UnitParsers,
  inheritedFontWeight?: number,
): void {
  const parsed = parseFontShorthand(value, inheritedFontWeight);
  if (!parsed) {
    return;
  }

  target.fontStyle = parsed.fontStyle;
  target.fontVariant = parsed.fontVariant;
  target.fontVariantNumeric = ["normal"];
  target.fontWeight = parsed.fontWeight;
  target.fontSize = parsed.fontSize;
  target.lineHeight = parsed.lineHeight;
  target.fontFamily = parsed.fontFamily;
}

export function parseFontShorthand(
  value: string,
  inheritedFontWeight?: number,
): ParsedFontShorthand | undefined {
  const tokens = tokenizeFontShorthand(value);
  if (tokens.length < 2) {
    return undefined;
  }

  let fontStyle = "normal";
  let fontVariant = "normal";
  let fontWeight = 400;
  let styleSeen = false;
  let variantSeen = false;
  let weightSeen = false;
  let sizeIndex = -1;
  let fontSize: StyleAccumulator["fontSize"];

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const normalized = token.toLowerCase();
    const parsedSize = parseFontSizeValue(token);
    if (parsedSize !== undefined) {
      sizeIndex = index;
      fontSize = parsedSize;
      break;
    }

    if (normalized === "normal") {
      continue;
    }

    if (FONT_STYLE_KEYWORDS.has(normalized)) {
      if (styleSeen) {
        return undefined;
      }
      styleSeen = true;
      fontStyle = normalized;
      if (normalized === "oblique" && ANGLE_TOKEN.test(tokens[index + 1] ?? "")) {
        index++;
      }
      continue;
    }

    if (FONT_VARIANT_KEYWORDS.has(normalized)) {
      if (variantSeen) {
        return undefined;
      }
      variantSeen = true;
      fontVariant = normalized;
      continue;
    }

    if (FONT_STRETCH_KEYWORDS.has(normalized)) {
      // font-stretch is not represented by ComputedStyle yet. Rejecting the
      // shorthand is safer than silently producing the wrong font selection.
      return undefined;
    }

    const parsedWeight = parseFontWeightValue(token, inheritedFontWeight);
    if (parsedWeight !== undefined) {
      if (weightSeen) {
        return undefined;
      }
      weightSeen = true;
      fontWeight = parsedWeight;
      continue;
    }

    return undefined;
  }

  if (sizeIndex < 0 || fontSize === undefined) {
    return undefined;
  }

  let cursor = sizeIndex + 1;
  let lineHeight: NonNullable<StyleAccumulator["lineHeight"]> = { kind: "normal" };
  if (tokens[cursor] === "/") {
    const parsedLineHeight = parseLineHeightValue(tokens[cursor + 1] ?? "");
    if (!parsedLineHeight) {
      return undefined;
    }
    lineHeight = parsedLineHeight;
    cursor += 2;
  }

  const fontFamily = tokens.slice(cursor).join(" ").trim();
  if (!fontFamily || fontFamily === "/") {
    return undefined;
  }

  return {
    fontStyle,
    fontVariant,
    fontWeight,
    fontSize,
    lineHeight,
    fontFamily,
  };
}

function tokenizeFontShorthand(value: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "\"" | "'" | null = null;
  let escaped = false;
  let parenthesisDepth = 0;

  const flush = (): void => {
    const token = current.trim();
    if (token) {
      tokens.push(token);
    }
    current = "";
  };

  for (const char of value.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      current += char;
      quote = char;
      continue;
    }
    if (char === "(") {
      parenthesisDepth++;
      current += char;
      continue;
    }
    if (char === ")") {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      current += char;
      continue;
    }
    if (parenthesisDepth === 0 && char === "/") {
      flush();
      tokens.push("/");
      continue;
    }
    if (parenthesisDepth === 0 && /\s/.test(char)) {
      flush();
      continue;
    }
    current += char;
  }
  flush();
  return tokens;
}
