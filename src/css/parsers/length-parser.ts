// src/css/parsers/length-parser.ts

import { ptToPx } from "../../units/units.js";
import { getViewportHeight, getViewportWidth } from "../viewport.js";
import { relativeLength, type RelativeLength } from "../length.js";

export function parseLength(value: string): number | RelativeLength | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "auto") {
    return undefined;
  }
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(px|pt|vh|vw|em|rem)?$/);
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
