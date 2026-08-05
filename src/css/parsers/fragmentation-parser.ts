import type { StyleAccumulator } from "../style.js";
import { registerPropertyParser } from "./registry.js";

export type BreakValue = "auto" | "avoid" | "avoid-page" | "page" | "left" | "right";

type FragmentationAccumulator = StyleAccumulator & {
  breakBefore?: BreakValue;
  breakAfter?: BreakValue;
  widows?: number;
  orphans?: number;
};

const MODERN_BREAK_VALUES = new Set<BreakValue>([
  "auto",
  "avoid",
  "avoid-page",
  "page",
  "left",
  "right",
]);

let registered = false;

export function registerFragmentationParsers(): void {
  if (registered) {
    return;
  }
  registered = true;
  registerPropertyParser("break-before", parseBreakBefore);
  registerPropertyParser("break-after", parseBreakAfter);
  registerPropertyParser("break-inside", parseBreakInside);
  registerPropertyParser("page-break-before", parseLegacyPageBreakBefore);
  registerPropertyParser("page-break-after", parseLegacyPageBreakAfter);
  registerPropertyParser("page-break-inside", parseLegacyPageBreakInside);
  registerPropertyParser("widows", parseWidows);
  registerPropertyParser("orphans", parseOrphans);
}

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

export function parseWidows(value: string, target: StyleAccumulator): void {
  const parsed = parsePositiveLineCount(value);
  if (parsed !== undefined) {
    (target as FragmentationAccumulator).widows = parsed;
  }
}

export function parseOrphans(value: string, target: StyleAccumulator): void {
  const parsed = parsePositiveLineCount(value);
  if (parsed !== undefined) {
    (target as FragmentationAccumulator).orphans = parsed;
  }
}

export function readBreakBefore(target: StyleAccumulator): BreakValue | undefined {
  return (target as FragmentationAccumulator).breakBefore;
}

export function readBreakAfter(target: StyleAccumulator): BreakValue | undefined {
  return (target as FragmentationAccumulator).breakAfter;
}

export function readWidows(target: StyleAccumulator): number | undefined {
  return (target as FragmentationAccumulator).widows;
}

export function readOrphans(target: StyleAccumulator): number | undefined {
  return (target as FragmentationAccumulator).orphans;
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

function parsePositiveLineCount(value: string): number | undefined {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    return undefined;
  }
  const parsed = Number.parseInt(normalized, 10);
  return parsed >= 1 ? parsed : undefined;
}
