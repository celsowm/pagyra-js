// src/css/parsers/length-parser.ts

import { cmToPx, inToPx, mmToPx, pcToPx, ptToPx, qToPx } from "../../units/units.js";
import { getViewportHeight, getViewportWidth } from "../viewport.js";
import { percent, relativeLength, type RelativeLength } from "../length.js";

const PERCENT_LENGTH_REGEX = /^(-?\d+(?:\.\d+)?)%$/;

export function parseLength(value: string): number | RelativeLength | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "auto") {
    return undefined;
  }
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(px|pt|vh|vw|em|rem|cm|mm|q|in|pc)?$/);
  if (!match) {
    return undefined;
  }
  const numeric = Number.parseFloat(match[1]);
  if (Number.isNaN(numeric)) {
    return undefined;
  }
  const unit = match[2] ?? "px";
  switch (unit) {
    case "px":
      return numeric;
    case "pt":
      return ptToPx(numeric);
    case "cm":
      return cmToPx(numeric);
    case "mm":
      return mmToPx(numeric);
    case "q":
      return qToPx(numeric);
    case "in":
      return inToPx(numeric);
    case "pc":
      return pcToPx(numeric);
    case "vh":
      return (numeric / 100) * getViewportHeight();
    case "vw":
      return (numeric / 100) * getViewportWidth();
    case "em":
    case "rem":
      return relativeLength(unit, numeric);
    default:
      return undefined;
  }
}

export function parseNumeric(value: string): number | RelativeLength | undefined {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px|pt|em|rem)?$/i);
  if (!match) {
    return undefined;
  }
  let n = Number.parseFloat(match[1]);
  const unit = (match[2] ?? "px").toLowerCase();
  if (unit === "pt") {
    n = ptToPx(n);
    return n;
  }
  if (unit === "em" || unit === "rem") {
    return relativeLength(unit, n);
  }
  return n;
}

export function parseLengthOrPercent(value: string): number | RelativeLength | ReturnType<typeof percent> | undefined {
  const parsed = parseLength(value);
  if (parsed !== undefined) {
    return parsed;
  }
  const match = PERCENT_LENGTH_REGEX.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const numeric = Number.parseFloat(match[1]);
  if (Number.isNaN(numeric)) {
    return undefined;
  }
  return percent(numeric / 100);
}

export function parseLengthOrAuto(value: string): number | RelativeLength | "auto" | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") {
    return "auto";
  }
  return parseLength(normalized);
}
