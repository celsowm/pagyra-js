export type LengthUnit = "px" | "percent";
export type RelativeLengthUnit = "em" | "rem";

export interface AbsoluteLength {
  readonly kind: "absolute";
  readonly unit: LengthUnit;
  readonly value: number;
}

export interface AutoLength {
  readonly kind: "auto";
}

export interface RelativeLength {
  readonly kind: "relative";
  readonly unit: RelativeLengthUnit;
  readonly value: number;
}

export interface CalcLength {
  readonly kind: "calc";
  readonly px: number;
  readonly percent: number;
  readonly em?: number;
  readonly rem?: number;
  readonly cqw?: number;
  readonly cqh?: number;
  readonly cqi?: number;
  readonly cqb?: number;
  readonly cqmin?: number;
  readonly cqmax?: number;
}

export type CSSLength = AbsoluteLength | AutoLength;

export type LengthLike = CSSLength | CalcLength | number | "auto";
export type LengthInput = LengthLike | RelativeLength;
export type NumericLength = number | RelativeLength;

export const AUTO_LENGTH: AutoLength = { kind: "auto" };

export function px(value: number): AbsoluteLength {
  return { kind: "absolute", unit: "px", value };
}

export function percent(ratio: number): AbsoluteLength {
  return { kind: "absolute", unit: "percent", value: ratio };
}

export function relativeLength(unit: RelativeLengthUnit, value: number): RelativeLength {
  return { kind: "relative", unit, value };
}

export function isRelativeLength(value: unknown): value is RelativeLength {
  if (!value || typeof value !== "object") {
    return false;
  }
  return (value as RelativeLength).kind === "relative";
}

export function isCalcLength(value: unknown): value is CalcLength {
  if (!value || typeof value !== "object") {
    return false;
  }
  return (value as CalcLength).kind === "calc";
}

export function resolveRelativeLength(value: RelativeLength, fontSize: number, rootFontSize: number): number {
  return value.unit === "em" ? value.value * fontSize : value.value * rootFontSize;
}

export function resolveNumberLike(
  value: number | RelativeLength | undefined,
  fontSize: number,
  rootFontSize: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return value;
  }
  return resolveRelativeLength(value, fontSize, rootFontSize);
}

export function resolveLengthInput(
  value: LengthInput | undefined,
  fontSize: number,
  rootFontSize: number,
): LengthLike | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isRelativeLength(value)) {
    return resolveRelativeLength(value, fontSize, rootFontSize);
  }
  if (isCalcLength(value)) {
    return {
      kind: "calc",
      px: value.px + (value.em ?? 0) * fontSize + (value.rem ?? 0) * rootFontSize,
      percent: value.percent,
      em: 0,
      rem: 0,
      cqw: value.cqw ?? 0,
      cqh: value.cqh ?? 0,
      cqi: value.cqi ?? 0,
      cqb: value.cqb ?? 0,
      cqmin: value.cqmin ?? 0,
      cqmax: value.cqmax ?? 0,
    };
  }
  return value;
}

export function isAutoLength(value: LengthLike): value is AutoLength | "auto" {
  if (typeof value === "string") {
    return value === "auto";
  }
  if (typeof value === "number") {
    return false;
  }
  return value.kind === "auto";
}

export function normalizeLength(value: LengthLike): CSSLength | CalcLength {
  if (typeof value === "number") {
    return px(value);
  }
  if (value === "auto") {
    return AUTO_LENGTH;
  }
  return value;
}

export interface ResolveLengthOptions {
  auto?: "reference" | "zero" | number;
  containerWidth?: number;
  containerHeight?: number;
}

export function resolveLength(
  value: LengthLike | undefined,
  reference: number,
  options: ResolveLengthOptions = { auto: "reference" },
): number {
  const autoBehavior = options.auto ?? "reference";
  const containerWidth = options.containerWidth ?? reference;
  const containerHeight = options.containerHeight ?? reference;
  if (value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  if (value === "auto") {
    return resolveAuto(autoBehavior, reference);
  }
  if (value.kind === "auto") {
    return resolveAuto(autoBehavior, reference);
  }
  if (value.kind === "calc") {
    const inlineSize = containerWidth;
    const blockSize = containerHeight;
    const minSize = Math.min(inlineSize, blockSize);
    const maxSize = Math.max(inlineSize, blockSize);
    return (
      value.px +
      value.percent * reference +
      (value.cqw ?? 0) * inlineSize +
      (value.cqi ?? 0) * inlineSize +
      (value.cqh ?? 0) * blockSize +
      (value.cqb ?? 0) * blockSize +
      (value.cqmin ?? 0) * minSize +
      (value.cqmax ?? 0) * maxSize
    );
  }
  if (value.unit === "percent") {
    return value.value * reference;
  }
  return value.value;
}

export interface ClampNumericLength {
  readonly kind: "clamp";
  readonly min: number | RelativeLength;
  readonly preferred: number | RelativeLength;
  readonly max: number | RelativeLength;
}

export function isClampNumericLength(value: unknown): value is ClampNumericLength {
  return value !== null && typeof value === "object" && (value as ClampNumericLength).kind === "clamp";
}

export function resolveClampNumericLength(
  value: ClampNumericLength,
  fontSize: number,
  rootFontSize: number,
): number | undefined {
  const min = resolveNumberLike(value.min, fontSize, rootFontSize);
  const preferred = resolveNumberLike(value.preferred, fontSize, rootFontSize);
  const max = resolveNumberLike(value.max, fontSize, rootFontSize);
  if (min === undefined || preferred === undefined || max === undefined) return undefined;
  return Math.min(Math.max(preferred, min), max);
}

export function clampMinMax(value: number, minValue: number | undefined, maxValue: number | undefined): number {
  const upper = maxValue ?? Number.POSITIVE_INFINITY;
  const lower = minValue ?? Number.NEGATIVE_INFINITY;
  return Math.min(Math.max(value, lower), upper);
}

function resolveAuto(autoBehavior: "reference" | "zero" | number, reference: number): number {
  if (autoBehavior === "reference") {
    return reference;
  }
  if (autoBehavior === "zero") {
    return 0;
  }
  return autoBehavior;
}
