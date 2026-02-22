// src/css/parsers/length-parser.ts

import { cmToPx, inToPx, mmToPx, pcToPx, ptToPx, qToPx } from "../../units/units.js";
import { getViewportHeight, getViewportWidth } from "../viewport.js";
import { percent, relativeLength, type CalcLength, type LengthInput, type RelativeLength } from "../length.js";
import { parseCalcLength } from "./calc-parser.js";

const PERCENT_LENGTH_REGEX = /^(-?\d+(?:\.\d+)?)%$/;
const CONTAINER_QUERY_LENGTH_REGEX = /^(-?\d+(?:\.\d+)?)(cqw|cqh|cqi|cqb|cqmin|cqmax)$/i;

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

export function parseLengthOrPercent(
  value: string,
): number | RelativeLength | ReturnType<typeof percent> | CalcLength | undefined {
  const parsed = parseLength(value);
  if (parsed !== undefined) {
    return parsed;
  }
  const match = PERCENT_LENGTH_REGEX.exec(value.trim());
  if (!match) {
    const cqMatch = CONTAINER_QUERY_LENGTH_REGEX.exec(value.trim());
    if (cqMatch) {
      const numeric = Number.parseFloat(cqMatch[1]);
      if (Number.isNaN(numeric)) {
        return undefined;
      }
      const ratio = numeric / 100;
      const unit = cqMatch[2].toLowerCase();
      switch (unit) {
        case "cqw":
          return { kind: "calc", px: 0, percent: 0, cqw: ratio };
        case "cqh":
          return { kind: "calc", px: 0, percent: 0, cqh: ratio };
        case "cqi":
          return { kind: "calc", px: 0, percent: 0, cqi: ratio };
        case "cqb":
          return { kind: "calc", px: 0, percent: 0, cqb: ratio };
        case "cqmin":
          return { kind: "calc", px: 0, percent: 0, cqmin: ratio };
        case "cqmax":
          return { kind: "calc", px: 0, percent: 0, cqmax: ratio };
        default:
          return undefined;
      }
    }
    return parseCalcLength(value);
  }
  const numeric = Number.parseFloat(match[1]);
  if (Number.isNaN(numeric)) {
    return undefined;
  }
  return percent(numeric / 100);
}

/**
 * Extract the three arguments from a CSS clamp() function.
 * Returns [min, preferred, max] strings or undefined if not a clamp value.
 */
export function parseClampArgs(value: string): [string, string, string] | undefined {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("clamp(") || !trimmed.endsWith(")")) {
    return undefined;
  }
  const inner = trimmed.slice(6, -1);
  const parts = inner.split(",");
  if (parts.length !== 3) {
    return undefined;
  }
  return [parts[0].trim(), parts[1].trim(), parts[2].trim()];
}

export function parseLengthOrAuto(value: string): LengthInput | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") {
    return "auto";
  }
  return parseLengthOrPercent(normalized);
}
