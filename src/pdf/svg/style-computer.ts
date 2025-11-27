import type { SvgDrawableNode, SvgGroupNode, SvgRootNode } from "../../svg/types.js";
import { parseColor } from "../utils/color-utils.js";

export interface SvgStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
  strokeDashArray?: number[];
  strokeDashOffset?: number;
  fillRule: "nonzero" | "evenodd";
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
  fontSize: number;
  fontFamily?: string;
  textAnchor?: "start" | "middle" | "end";
}

export function deriveStyle(base: SvgStyle, node: SvgDrawableNode | SvgGroupNode | SvgRootNode): SvgStyle {
  const style: SvgStyle = { ...base };
  const attrs = node.attributes ?? {};

  if (attrs.opacity !== undefined) {
    const value = parseOpacity(attrs.opacity);
    if (value !== undefined) {
      style.opacity = clamp01(style.opacity * value);
    }
  }

  if (attrs.fill !== undefined) {
    const fillValue = attrs.fill.trim();
    style.fill = !fillValue || fillValue === "none" ? undefined : fillValue;
  }

  if (attrs["fill-opacity"] !== undefined) {
    const value = parseOpacity(attrs["fill-opacity"]);
    if (value !== undefined) {
      style.fillOpacity = clamp01(value);
    }
  }

  if (attrs.stroke !== undefined) {
    const strokeValue = attrs.stroke.trim();
    style.stroke = !strokeValue || strokeValue === "none" ? undefined : strokeValue;
  }

  if (attrs["stroke-opacity"] !== undefined) {
    const value = parseOpacity(attrs["stroke-opacity"]);
    if (value !== undefined) {
      style.strokeOpacity = clamp01(value);
    }
  }

  if (attrs["stroke-width"] !== undefined) {
    const value = parseNumber(attrs["stroke-width"]);
    if (value !== undefined) {
      style.strokeWidth = value;
    }
  }

  if (attrs["stroke-linecap"] !== undefined) {
    const cap = normalizeLineCap(attrs["stroke-linecap"]);
    if (cap) {
      style.strokeLinecap = cap;
    }
  }

  if (attrs["stroke-linejoin"] !== undefined) {
    const join = normalizeLineJoin(attrs["stroke-linejoin"]);
    if (join) {
      style.strokeLinejoin = join;
    }
  }

  if (attrs["stroke-dasharray"] !== undefined) {
    const value = parseDashArray(attrs["stroke-dasharray"]);
    if (value) {
      style.strokeDashArray = value;
    }
  }

  if (attrs["stroke-dashoffset"] !== undefined) {
    const value = parseNumber(attrs["stroke-dashoffset"]);
    if (value !== undefined) {
      style.strokeDashOffset = value;
    }
  }

  if (attrs["fill-rule"] !== undefined) {
    const rule = normalizeFillRule(attrs["fill-rule"]);
    if (rule) {
      style.fillRule = rule;
    }
  }

  if (attrs["font-size"] !== undefined) {
    const value = parseNumber(attrs["font-size"]);
    if (value !== undefined) {
      style.fontSize = value;
    }
  }

  if (attrs["font-family"] !== undefined) {
    const family = attrs["font-family"].trim();
    if (family) {
      style.fontFamily = family;
    }
  }

  if (attrs["text-anchor"] !== undefined) {
    const anchor = normalizeTextAnchor(attrs["text-anchor"]);
    if (anchor) {
      style.textAnchor = anchor;
    }
  }

  return style;
}

export function createDefaultStyle(): SvgStyle {
  return {
    fill: "#000000",
    stroke: undefined,
    strokeWidth: 1,
    strokeLinecap: "butt",
    strokeLinejoin: "miter",
    strokeDashArray: undefined,
    strokeDashOffset: 0,
    fillRule: "nonzero",
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
    fontSize: 16,
    fontFamily: undefined,
    textAnchor: "start",
  };
}

export function resolvePaint(value: string | undefined, opacity: number): { r: number; g: number; b: number; a: number } | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "none") {
    return undefined;
  }
  const color = parseColor(value);
  if (!color) {
    return undefined;
  }
  const baseAlpha = color.a ?? 1;
  return {
    r: color.r,
    g: color.g,
    b: color.b,
    a: clamp01(baseAlpha * opacity),
  };
}

function parseOpacity(value: string | undefined): number | undefined {
  const parsed = parseNumber(value);
  if (parsed === undefined) {
    return undefined;
  }
  return clamp01(parsed);
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num)) {
    return undefined;
  }
  return num;
}

function normalizeLineCap(value: string): "butt" | "round" | "square" | undefined {
  const lower = value.trim().toLowerCase();
  if (lower === "butt" || lower === "round" || lower === "square") {
    return lower;
  }
  return undefined;
}

function normalizeLineJoin(value: string): "miter" | "round" | "bevel" | undefined {
  const lower = value.trim().toLowerCase();
  if (lower === "miter" || lower === "round" || lower === "bevel") {
    return lower;
  }
  return undefined;
}

function normalizeFillRule(value: string): "nonzero" | "evenodd" | undefined {
  const lower = value.trim().toLowerCase();
  if (lower === "nonzero" || lower === "evenodd") {
    return lower;
  }
  return undefined;
}

function normalizeTextAnchor(value: string): "start" | "middle" | "end" | undefined {
  const lower = value.trim().toLowerCase();
  if (lower === "start" || lower === "middle" || lower === "end") {
    return lower;
  }
  return undefined;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function parseDashArray(value: string | undefined): number[] | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === "none") {
    return undefined;
  }
  const parts = trimmed
    .split(/[\s,]+/)
    .map((part) => Number.parseFloat(part))
    .filter((num) => Number.isFinite(num) && num >= 0);

  if (parts.length === 0) {
    return undefined;
  }
  return parts;
}
