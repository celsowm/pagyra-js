// src/css/parsers/color-parser.ts

import type { StyleAccumulator } from "../style.js";

export function parseColor(value: string, target: StyleAccumulator): void {
  target.color = value;
}

export function parseBackgroundColor(value: string, target: StyleAccumulator): void {
  if (!target.backgroundLayers) {
    target.backgroundLayers = [];
  }
  target.backgroundLayers.push({ kind: "color", color: value });
}
