// src/css/parsers/grid-parser-extended.ts

import { parseGap as parseGapValue, parseGridTemplate } from "./grid-parser.js";
import { parseClampArgs, parseLength } from "./length-parser.js";
import type { ClampNumericLength } from "../length.js";
import type { GridAutoFlow, StyleAccumulator } from "../style.js";

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
    return;
  }
  const clampArgs = parseClampArgs(value);
  if (clampArgs) {
    const min = parseLength(clampArgs[0]);
    const preferred = parseLength(clampArgs[1]);
    const max = parseLength(clampArgs[2]);
    if (min !== undefined && preferred !== undefined && max !== undefined) {
      const clampValue: ClampNumericLength = { kind: "clamp", min, preferred, max };
      target.rowGap = clampValue;
    }
  }
}

export function parseGridColumn(value: string, target: StyleAccumulator): void {
  const trimmed = value.trim().toLowerCase();
  // Handle "span N" pattern
  const spanMatch = trimmed.match(/^span\s+(\d+)$/);
  if (spanMatch) {
    const span = Number.parseInt(spanMatch[1], 10);
    if (Number.isFinite(span) && span > 0) {
      target.gridColumnSpan = span;
      return;
    }
  }
  // Handle plain integer (line number, treat as span 1)
  const num = Number.parseInt(trimmed, 10);
  if (Number.isFinite(num) && num > 0) {
    target.gridColumnSpan = 1;
  }
}

export function parseColumnGap(value: string, target: StyleAccumulator): void {
  const parsed = parseLength(value);
  if (parsed !== undefined) {
    target.columnGap = parsed;
    return;
  }
  const clampArgs = parseClampArgs(value);
  if (clampArgs) {
    const min = parseLength(clampArgs[0]);
    const preferred = parseLength(clampArgs[1]);
    const max = parseLength(clampArgs[2]);
    if (min !== undefined && preferred !== undefined && max !== undefined) {
      const clampValue: ClampNumericLength = { kind: "clamp", min, preferred, max };
      target.columnGap = clampValue;
    }
  }
}
