import type { RGBA } from "../types.js";
import type { GraphicsStateManager } from "./graphics-state-manager.js";

export function normalizeChannel(value: number): number {
  if (value > 1) {
    return value / 255;
  }
  return value;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function fillColorCommand(color: RGBA, graphicsStateManager?: GraphicsStateManager): string {
  const r = formatNumber(normalizeChannel(color.r));
  const g = formatNumber(normalizeChannel(color.g));
  const b = formatNumber(normalizeChannel(color.b));
  const alpha = color.a ?? 1;
  if (alpha < 1 && graphicsStateManager) {
    const stateName = graphicsStateManager.ensureFillAlphaState(alpha);
    return `/${stateName} gs\n${r} ${g} ${b} rg`;
  }
  return `${r} ${g} ${b} rg`;
}
