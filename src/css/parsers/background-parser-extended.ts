// src/css/parsers/background-parser-extended.ts

import { parseLinearGradient } from "./gradient-parser.js";
import { parseBackgroundShorthand, applyBackgroundSize } from "./background-parser.js";
import type { StyleAccumulator } from "../style.js";
import type { UnitParsers } from "../../units/units.js";

export function applyBackgroundSizeDecl(value: string, target: StyleAccumulator): void {
  applyBackgroundSize(target, value);
}

export function parseBackgroundImage(value: string, target: StyleAccumulator): void {
  const gradient = parseLinearGradient(value);
  if (gradient) {
    if (!target.backgroundLayers) {
      target.backgroundLayers = [];
    }
    target.backgroundLayers.push({ kind: "gradient", gradient });
  }
}

export function parseBackground(value: string, target: StyleAccumulator): void {
  console.log("Processing background property:", value);
  const layers = parseBackgroundShorthand(value);
  console.log("Parsed background layers:", layers);
  if (layers.length > 0) {
    if (!target.backgroundLayers) {
      target.backgroundLayers = [];
    }
    target.backgroundLayers.push(...layers);
  }
}

export function parseObjectFit(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase();
  if (["contain", "cover", "fill", "none", "scale-down"].includes(normalized)) {
    target.objectFit = normalized;
  }
}
