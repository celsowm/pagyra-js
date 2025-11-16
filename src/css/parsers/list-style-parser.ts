// src/css/parsers/list-style-parser.ts

import type { StyleAccumulator } from "../style.js";

const LIST_STYLE_KEYWORD_MAP: Record<string, string> = {
  none: "none",
  disc: "disc",
  circle: "circle",
  square: "square",
  decimal: "decimal",
  "decimal-leading-zero": "decimal-leading-zero",
  "lower-alpha": "lower-alpha",
  "lower-latin": "lower-alpha",
  "upper-alpha": "upper-alpha",
  "upper-latin": "upper-alpha",
  "lower-roman": "lower-roman",
  "upper-roman": "upper-roman",
};

const INHERITABLE_KEYWORDS = new Set(["inherit", "unset", "revert", "revert-layer"]);

export function parseListStyleType(value: string, target: StyleAccumulator): void {
  if (!value) {
    return;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return;
  }
  if (normalized === "initial") {
    target.listStyleType = "disc";
    return;
  }
  if (INHERITABLE_KEYWORDS.has(normalized)) {
    return;
  }
  target.listStyleType = LIST_STYLE_KEYWORD_MAP[normalized] ?? normalized;
}

