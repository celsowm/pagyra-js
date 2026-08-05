import type { StyleAccumulator, Visibility } from "../style.js";
import { registerPropertyParser } from "./registry.js";

const VALUES = new Set<Visibility>(["visible", "hidden", "collapse"]);
let registered = false;

export function registerVisibilityParser(): void {
  if (registered) {
    return;
  }
  registered = true;
  registerPropertyParser("visibility", parseVisibility);
}

export function parseVisibility(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase() as Visibility;
  if (VALUES.has(normalized)) {
    target.visibility = normalized;
  }
}
