// src/css/parsers/overflow-wrap-parser.ts

import type { OverflowWrap, StyleAccumulator } from "../style.js";

function normalizeOverflowWrap(value: string): OverflowWrap | undefined {
  switch (value) {
    case "normal":
      return "normal";
    case "anywhere":
      return "anywhere";
    case "break-word":
      return "break-word";
    default:
      return undefined;
  }
}

export function parseOverflowWrap(value: string, target: StyleAccumulator): void {
  if (!value) {
    return;
  }
  const keyword = normalizeOverflowWrap(value.trim().toLowerCase());
  if (keyword) {
    target.overflowWrap = keyword;
  }
}

export function parseWordWrap(value: string, target: StyleAccumulator): void {
  if (!value) {
    return;
  }
  const keyword = normalizeOverflowWrap(value.trim().toLowerCase());
  if (!keyword) {
    return;
  }
  // The legacy property only supports normal/break-word, but map through the same normalization.
  target.overflowWrap = keyword === "anywhere" ? "break-word" : keyword;
}
