import type { StyleAccumulator } from "../style.js";

export type BreakValue = "auto" | "avoid" | "avoid-page" | "page" | "left" | "right";

type FragmentationAccumulator = StyleAccumulator & {
  breakBefore?: BreakValue;
  breakAfter?: BreakValue;
};

const MODERN_BREAK_VALUES = new Set<BreakValue>([
  "auto",
  "avoid",
  "avoid-page",
  "page",
  "left",
  "right",
]);

export function parseBreakBefore(value: string, target: StyleAccumulator): void {
  const parsed = normalizeModernBreak(value);
  if (parsed) {
    (target as FragmentationAccumulator).breakBefore = parsed;
  }
}

export function parseBreakAfter(value: string, target: StyleAccumulator): void {
  const parsed = normalizeModernBreak(value);
  if (parsed) {
    (target as FragmentationAccumulator).breakAfter = parsed;
  }
}

export function parseBreakInside(value: string, target: StyleAccumulator): void {
  const parsed = normalizeModernBreak(value);
  if (parsed === "auto" || parsed === "avoid" || parsed === "avoid-page") {
    target.breakInside = parsed === "avoid-page" ? "avoid" : parsed;
  }
}

export function parseLegacyPageBreakBefore(value: string, target: StyleAccumulator): void {
  const parsed = normalizeLegacyBreak(value);
  if (parsed) {
    (target as FragmentationAccumulator).breakBefore = parsed;
  }
}

export function parseLegacyPageBreakAfter(value: string, target: StyleAccumulator): void {
  const parsed = normalizeLegacyBreak(value);
  if (parsed) {
    (target as FragmentationAccumulator).breakAfter = parsed;
  }
}

export function parseLegacyPageBreakInside(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto" || normalized === "avoid") {
    target.breakInside = normalized;
  }
}

export function readBreakBefore(target: StyleAccumulator): BreakValue | undefined {
  return (target as FragmentationAccumulator).breakBefore;
}

export function readBreakAfter(target: StyleAccumulator): BreakValue | undefined {
  return (target as FragmentationAccumulator).breakAfter;
}

function normalizeModernBreak(value: string): BreakValue | undefined {
  const normalized = value.trim().toLowerCase() as BreakValue;
  return MODERN_BREAK_VALUES.has(normalized) ? normalized : undefined;
}

function normalizeLegacyBreak(value: string): BreakValue | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "always") {
    return "page";
  }
  if (normalized === "auto" || normalized === "avoid" || normalized === "left" || normalized === "right") {
    return normalized;
  }
  return undefined;
}
