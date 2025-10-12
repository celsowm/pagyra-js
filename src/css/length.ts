export type LengthUnit = "px" | "percent";

export interface AbsoluteLength {
  readonly kind: "absolute";
  readonly unit: LengthUnit;
  readonly value: number;
}

export interface AutoLength {
  readonly kind: "auto";
}

export type CSSLength = AbsoluteLength | AutoLength;

export type LengthLike = CSSLength | number | "auto";

export const AUTO_LENGTH: AutoLength = { kind: "auto" };

export function px(value: number): AbsoluteLength {
  return { kind: "absolute", unit: "px", value };
}

export function percent(ratio: number): AbsoluteLength {
  return { kind: "absolute", unit: "percent", value: ratio };
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

export function normalizeLength(value: LengthLike): CSSLength {
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
}

export function resolveLength(
  value: LengthLike | undefined,
  reference: number,
  options: ResolveLengthOptions = { auto: "reference" },
): number {
  const autoBehavior = options.auto ?? "reference";
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
  if (value.unit === "percent") {
    return value.value * reference;
  }
  return value.value;
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
