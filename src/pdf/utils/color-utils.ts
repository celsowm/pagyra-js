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

  const hexMatch = normalized.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    const digits = hexMatch[1];
    if (digits.length === 3) {
      const r = parseHex(digits[0] + digits[0]);
      const g = parseHex(digits[1] + digits[1]);
      const b = parseHex(digits[2] + digits[2]);
      return { r, g, b, a: 1 };
    }
    if (digits.length === 4) {
      const r = parseHex(digits[0] + digits[0]);
      const g = parseHex(digits[1] + digits[1]);
      const b = parseHex(digits[2] + digits[2]);
      const a = parseHex(digits[3] + digits[3]) / 255;
      return { r, g, b, a };
    }
    if (digits.length === 6) {
      const r = parseHex(digits.slice(0, 2));
      const g = parseHex(digits.slice(2, 4));
      const b = parseHex(digits.slice(4, 6));
      return { r, g, b, a: 1 };
    }
    // 8 digits
    const r = parseHex(digits.slice(0, 2));
    const g = parseHex(digits.slice(2, 4));
    const b = parseHex(digits.slice(4, 6));
    const a = parseHex(digits.slice(6, 8)) / 255;
    return { r, g, b, a };
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

/**
 * Converts a CSS color string to a PDF RGB color array [r, g, b] where values are normalized to 0-1.
 * Ignores alpha channel.
 */
export function cssColorStringToPdfRgbArray(colorString: string): number[] | undefined {
  const rgba = parseColor(colorString);
  if (!rgba) return undefined;
  return [rgba.r / 255, rgba.g / 255, rgba.b / 255];
}

/**
 * Converts RGB values (0-255) to CMYK array [c, m, y, k] normalized to 0-1.
 */
export function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const rNorm = Math.max(0, Math.min(1, r / 255));
  const gNorm = Math.max(0, Math.min(1, g / 255));
  const bNorm = Math.max(0, Math.min(1, b / 255));

  const k = 1 - Math.max(rNorm, gNorm, bNorm);
  const c = k === 1 ? 0 : (1 - rNorm - k) / (1 - k);
  const m = k === 1 ? 0 : (1 - gNorm - k) / (1 - k);
  const y = k === 1 ? 0 : (1 - bNorm - k) / (1 - k);

  return [c, m, y, k];
}
