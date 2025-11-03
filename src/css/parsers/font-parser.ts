// src/css/parsers/font-parser.ts

import { parseFontWeightValue } from "../font-weight.js";
import type { StyleAccumulator } from "../style.js";
import type { UnitParsers } from "../../units/units.js";

export function parseFontFamily(value: string, target: StyleAccumulator): void {
  target.fontFamily = value;
}

export function parseFontWeight(value: string, target: StyleAccumulator, units: UnitParsers, inheritedFontWeight?: number): void {
  const parsed = parseFontWeightValue(value, inheritedFontWeight);
  if (parsed !== undefined) {
    target.fontWeight = parsed;
  }
}
