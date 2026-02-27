import type { WordBreak, StyleAccumulator } from "../style.js";

function normalizeWordBreak(value: string): WordBreak | undefined {
  switch (value) {
    case "normal":
      return "normal";
    case "break-all":
      return "break-all";
    case "keep-all":
      return "keep-all";
    case "break-word":
      return "break-word";
    default:
      return undefined;
  }
}

export function parseWordBreak(value: string, target: StyleAccumulator): void {
  if (!value) {
    return;
  }
  const keyword = normalizeWordBreak(value.trim().toLowerCase());
  if (keyword) {
    target.wordBreak = keyword;
  }
}
