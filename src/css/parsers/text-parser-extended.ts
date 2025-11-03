// src/css/parsers/text-parser-extended.ts

import { parseTextDecorationLine as parseTextDecorationLineValue } from "./text-parser.js";
import type { StyleAccumulator } from "../style.js";
import type { UnitParsers } from "../../units/units.js";

export function parseTextAlign(value: string, target: StyleAccumulator): void {
  target.textAlign = value.toLowerCase();
}

export function parseTextDecoration(value: string, target: StyleAccumulator): void {
  const parsed = parseTextDecorationLineValue(value);
  if (parsed !== undefined) {
    target.textDecorationLine = parsed;
  }
}

export function parseTextDecorationLine(value: string, target: StyleAccumulator): void {
  const parsed = parseTextDecorationLineValue(value);
  if (parsed !== undefined) {
    target.textDecorationLine = parsed;
  }
}

export function parseFloat(value: string, target: StyleAccumulator): void {
  target.float = value;
}
