// src/css/parsers/grid-parser-extended.ts

import { parseGap as parseGapValue, parseGridTemplate } from "./grid-parser.js";
import { parseLength } from "./length-parser.js";
import type { GridAutoFlow, StyleAccumulator } from "../style.js";
import type { UnitParsers } from "../../units/units.js";

export function parseGridTemplateColumns(value: string, target: StyleAccumulator): void {
  const parsed = parseGridTemplate(value);
  if (parsed) {
    target.trackListColumns = parsed;
  }
}

export function parseGridTemplateRows(value: string, target: StyleAccumulator): void {
  const parsed = parseGridTemplate(value);
  if (parsed) {
    target.trackListRows = parsed;
  }
}

export function parseGridAutoFlow(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "row":
    case "column":
    case "row dense":
    case "column dense":
      target.autoFlow = normalized as GridAutoFlow;
      break;
    default:
      break;
  }
}

export function parseGap(value: string, target: StyleAccumulator): void {
  const parsed = parseGapValue(value);
  if (parsed) {
    target.rowGap = parsed.row;
    target.columnGap = parsed.column;
  }
}

export function parseRowGap(value: string, target: StyleAccumulator): void {
  const parsed = parseLength(value);
  if (parsed !== undefined) {
    target.rowGap = parsed;
  }
}

export function parseColumnGap(value: string, target: StyleAccumulator): void {
  const parsed = parseLength(value);
  if (parsed !== undefined) {
    target.columnGap = parsed;
  }
}
