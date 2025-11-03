// src/css/parsers/font-parser.ts

import { parseFontWeightValue } from "../font-weight.js";
import type { StyleAccumulator } from "../style.js";
import type { UnitParsers } from "../../units/units.js";

export function parseFontFamily(value: string, target: StyleAccumulator): void {
  target.fontFamily = value;
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

export function parseFontWeight(value: string, target: StyleAccumulator, units: UnitParsers, inheritedFontWeight?: number): void {
  const parsed = parseFontWeightValue(value, inheritedFontWeight);
  if (parsed !== undefined) {
    target.fontWeight = parsed;
  }
}
