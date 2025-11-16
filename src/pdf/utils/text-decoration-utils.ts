import type { ComputedStyle } from "../../css/style.js";
import type { Decorations } from "../types.js";

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
  return decoration.underline || decoration.overline || decoration.lineThrough ? decoration : undefined;
}
