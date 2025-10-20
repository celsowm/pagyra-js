import { NAMED_COLORS } from "../../css/named-colors.js";
import type { RGBA } from "../types.js";

export function parseColor(value: string | undefined): RGBA | undefined {
  if (!value) {
    return undefined;
  }

  let normalized = value.trim().toLowerCase();
  if (normalized in NAMED_COLORS) {
    normalized = NAMED_COLORS[normalized];
  }

  if (normalized === "transparent") {
    return undefined;
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const digits = hexMatch[1];
    if (digits.length === 3) {
      const r = parseHex(digits[0] + digits[0]);
      const g = parseHex(digits[1] + digits[1]);
      const b = parseHex(digits[2] + digits[2]);
      return { r, g, b, a: 1 };
    }
    const r = parseHex(digits.slice(0, 2));
    const g = parseHex(digits.slice(2, 4));
    const b = parseHex(digits.slice(4, 6));
    return { r, g, b, a: 1 };
  }
  const rgbMatch = normalized.match(/^rgba?\((.+)\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((part) => part.trim());
    const r = clampColor(Number.parseFloat(parts[0]));
    const g = clampColor(Number.parseFloat(parts[1]));
    const b = clampColor(Number.parseFloat(parts[2]));
    const a = parts[3] !== undefined ? clampAlpha(Number.parseFloat(parts[3])) : 1;
    return { r, g, b, a };
  }
  return undefined;
}

function parseHex(value: string): number {
  return Number.parseInt(value, 16);
}

export function clampColor(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value > 255) {
    return 255;
  }
  if (value < 0) {
    return 0;
  }
  return value;
}

export function clampAlpha(value: number): number {
  if (Number.isNaN(value)) {
    return 1;
  }
  if (value > 1) {
    return 1;
  }
  if (value < 0) {
    return 0;
  }
  return value;
}

export function cloneColor(color: RGBA): RGBA {
  return { r: color.r, g: color.g, b: color.b, a: color.a };
}
