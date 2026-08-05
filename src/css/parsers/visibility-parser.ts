import type { StyleAccumulator, Visibility } from "../style.js";

const VALUES = new Set<Visibility>(["visible", "hidden", "collapse"]);

export function parseVisibility(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase() as Visibility;
  if (VALUES.has(normalized)) {
    target.visibility = normalized;
  }
}
