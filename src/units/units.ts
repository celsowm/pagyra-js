// src/units/units.ts

import { parseLength, parseLengthOrPercent } from "../css/parsers/length-parser.js";

const DPI = 96;
const INCHES_PER_CM = 1 / 2.54;

export function cmToPx(cm: number): number {
  return cm * INCHES_PER_CM * DPI;
}

export function mmToPx(mm: number): number {
  return (mm / 10) * INCHES_PER_CM * DPI;
}

export function qToPx(q: number): number {
  return (q / 40) * INCHES_PER_CM * DPI;
}

export function inToPx(inches: number): number {
  return inches * DPI;
}

export function pcToPx(pc: number): number {
  return pc * (DPI / 6);
}

export function ptToPx(pt: number): number {
  return pt * (DPI / 72);
}

export function pxToPt(px: number): number {
  return px * (72 / DPI);
}

export interface UnitCtx {
  viewport: {
    width: number;
    height: number;
  };
}

export function makeUnitParsers(ctx: UnitCtx) {
  return {
    parseLength: (value: string) => parseLength(value),
    parseLengthOrPercent: (value: string) => parseLengthOrPercent(value),
  };
}

export type UnitParsers = ReturnType<typeof makeUnitParsers>;
