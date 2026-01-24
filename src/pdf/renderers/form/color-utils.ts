import type { RGBA } from "../../types.js";
import { formatNumber, normalizeChannel } from "../text-renderer-utils.js";

export function formatPdfRgb(color: RGBA): string {
  const r = formatNumber(normalizeChannel(color.r));
  const g = formatNumber(normalizeChannel(color.g));
  const b = formatNumber(normalizeChannel(color.b));
  return `${r} ${g} ${b}`;
}
