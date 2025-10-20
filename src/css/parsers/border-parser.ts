// src/css/parsers/border-parser.ts

import { clampPositive, splitCssList } from "../utils.js";
import { parseLength } from "./length-parser.js";

export const BORDER_STYLE_KEYWORDS = new Set([
  "none",
  "hidden",
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

export const BORDER_WIDTH_KEYWORD_MAP: Record<string, number> = {
  thin: 1,
  medium: 3,
  thick: 5,
};

export const DEFAULT_BORDER_WIDTH = BORDER_WIDTH_KEYWORD_MAP.medium;

export interface ParsedBorder {
  width?: number;
  style?: string;
  color?: string;
}

export function parseBorderShorthand(value: string): ParsedBorder | null {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return null;
  }

  let width: number | undefined;
  let style: string | undefined;
  let color: string | undefined;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    if (width === undefined) {
      const maybeWidth = parseBorderWidth(trimmed);
      if (maybeWidth !== undefined) {
        width = maybeWidth;
        continue;
      }
    }

    const lower = trimmed.toLowerCase();
    if (!style && BORDER_STYLE_KEYWORDS.has(lower)) {
      style = lower;
      continue;
    }

    if (color === undefined) {
      color = trimmed;
    }
  }

  if (style === "none" || style === "hidden") {
    width = 0;
  } else if (width === undefined && style) {
    width = DEFAULT_BORDER_WIDTH;
  }

  return { width, style, color };
}

export function parseBorderWidth(value: string): number | undefined {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed in BORDER_WIDTH_KEYWORD_MAP) {
    return BORDER_WIDTH_KEYWORD_MAP[trimmed];
  }
  return parseLength(value);
}

export interface ParsedCornerRadiusPair {
  x: number;
  y: number;
}

export interface ParsedBorderRadius {
  topLeft: ParsedCornerRadiusPair;
  topRight: ParsedCornerRadiusPair;
  bottomRight: ParsedCornerRadiusPair;
  bottomLeft: ParsedCornerRadiusPair;
}

export function parseBorderRadiusShorthand(value: string): ParsedBorderRadius | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const [horizontalPart, verticalPart] = trimmed.split("/").map((part) => part.trim());
  const horizontalValues = expandBorderRadiusList(horizontalPart);
  if (!horizontalValues) {
    return null;
  }
  const verticalValues = verticalPart ? expandBorderRadiusList(verticalPart) : horizontalValues;
  if (!verticalValues) {
    return null;
  }
  return {
    topLeft: { x: horizontalValues[0], y: verticalValues[0] },
    topRight: { x: horizontalValues[1], y: verticalValues[1] },
    bottomRight: { x: horizontalValues[2], y: verticalValues[2] },
    bottomLeft: { x: horizontalValues[3], y: verticalValues[3] },
  };
}

export function parseBorderCornerRadius(value: string): ParsedCornerRadiusPair | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const [horizontalRaw, verticalRaw] = trimmed.split("/").map((part) => part.trim());
  const horizontalList = splitCssList(horizontalRaw);
  if (horizontalList.length === 0) {
    return undefined;
  }
  const horizontal = clampPositive(parseLength(horizontalList[0]));
  let vertical: number;
  if (verticalRaw) {
    const verticalList = splitCssList(verticalRaw);
    vertical = clampPositive(parseLength(verticalList[0]));
  } else if (horizontalList.length > 1) {
    vertical = clampPositive(parseLength(horizontalList[1]));
  } else {
    vertical = horizontal;
  }
  return { x: horizontal, y: vertical };
}

function expandBorderRadiusList(input: string | undefined): [number, number, number, number] | null {
  if (!input) {
    return null;
  }
  const parts = splitCssList(input);
  if (parts.length === 0) {
    return null;
  }
  const resolved = parts.map((part) => clampPositive(parseLength(part)));
  switch (resolved.length) {
    case 1:
      return [resolved[0], resolved[0], resolved[0], resolved[0]];
    case 2:
      return [resolved[0], resolved[1], resolved[0], resolved[1]];
    case 3:
      return [resolved[0], resolved[1], resolved[2], resolved[1]];
    default:
      return [resolved[0], resolved[1], resolved[2], resolved[3]];
  }
}
