import { resolveRelativeLength, type NumericLength } from "./length.js";

export interface NormalLineHeight {
  kind: "normal";
}

export interface UnitlessLineHeight {
  kind: "unitless";
  value: number;
}

export interface AbsoluteLineHeight<TValue = number> {
  kind: "length";
  value: TValue;
}

export type LineHeightValue = NormalLineHeight | UnitlessLineHeight | AbsoluteLineHeight<number>;
export type LineHeightInput = NormalLineHeight | UnitlessLineHeight | AbsoluteLineHeight<NumericLength>;

export const DEFAULT_NORMAL_LINE_HEIGHT = 1.2;

export function createNormalLineHeight(): NormalLineHeight {
  return { kind: "normal" };
}

export function createUnitlessLineHeight(value: number): UnitlessLineHeight {
  return { kind: "unitless", value };
}

export function createLengthLineHeight(value: number): AbsoluteLineHeight<number> {
  return { kind: "length", value };
}

export function cloneLineHeight(value: LineHeightValue): LineHeightValue {
  switch (value.kind) {
    case "normal":
      return createNormalLineHeight();
    case "unitless":
      return createUnitlessLineHeight(value.value);
    case "length":
      return createLengthLineHeight(value.value);
    default:
      return createNormalLineHeight();
  }
}

export function resolveLineHeightInput(
  input: LineHeightInput,
  fontSize: number,
  rootFontSize: number,
): LineHeightValue {
  switch (input.kind) {
    case "normal":
      return createNormalLineHeight();
    case "unitless":
      return createUnitlessLineHeight(input.value);
    case "length": {
      const raw = input.value;
      const pxValue = typeof raw === "number" ? raw : resolveRelativeLength(raw, fontSize, rootFontSize);
      return createLengthLineHeight(pxValue);
    }
    default:
      return createNormalLineHeight();
  }
}

export function lineHeightEquals(a: LineHeightValue, b: LineHeightValue): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === "unitless" || a.kind === "length") {
    return a.value === (b as UnitlessLineHeight | AbsoluteLineHeight<number>).value;
  }
  return true;
}

export function lineHeightToPx(
  value: LineHeightValue | undefined,
  fontSize: number | undefined,
  normalRatio = DEFAULT_NORMAL_LINE_HEIGHT,
): number {
  const size = fontSize ?? 16;
  if (!value) {
    return size * normalRatio;
  }
  switch (value.kind) {
    case "normal":
      return size * normalRatio;
    case "unitless":
      return value.value * size;
    case "length":
      return value.value;
    default:
      return size * normalRatio;
  }
}
