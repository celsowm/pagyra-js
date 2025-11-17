import type { ComputedStyle } from "../../css/style.js";
import type { Decorations, RGBA } from "../types.js";
import { parseColor } from "./color-utils.js";

export function resolveDecorations(style: ComputedStyle): Decorations | undefined {
  const value = style.textDecorationLine?.trim().toLowerCase();
  if (!value || value === "none") {
    return undefined;
  }
  const tokens = value.split(/\s+/);
  const decoration: Decorations = {};
  for (const token of tokens) {
    switch (token) {
      case "underline":
        decoration.underline = true;
        break;
      case "overline":
        decoration.overline = true;
        break;
      case "line-through":
        decoration.lineThrough = true;
        break;
      default:
        break;
    }
  }
  if (!(decoration.underline || decoration.overline || decoration.lineThrough)) {
    return undefined;
  }
  const color = resolveDecorationColor(style);
  if (color) {
    decoration.color = color;
  }
  return decoration;
}

function resolveDecorationColor(style: ComputedStyle): RGBA | undefined {
  const raw = style.textDecorationColor;
  if (raw) {
    if (raw.toLowerCase() === "currentcolor") {
      return parseColor(style.color);
    }
    const parsed = parseColor(raw);
    if (parsed) {
      return parsed;
    }
  }
  return parseColor(style.color);
}
