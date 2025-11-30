// src/css/parsers/background-parser-extended.ts

import { parseLinearGradient, parseRadialGradient } from "./gradient-parser.js";
import {
  parseBackgroundShorthand,
  applyBackgroundSize,
  applyBackgroundPosition,
  applyBackgroundOrigin,
  applyBackgroundRepeat,
  ensureLayers,
} from "./background-parser.js";
import type { StyleAccumulator } from "../style.js";
import type { BackgroundClip } from "../background-types.js";

const BACKGROUND_CLIP_VALUES = new Set<BackgroundClip>([
  "border-box",
  "padding-box",
  "content-box",
  "text",
]);

export function applyBackgroundSizeDecl(value: string, target: StyleAccumulator): void {
  applyBackgroundSize(target, value);
}

export function applyBackgroundPositionDecl(value: string, target: StyleAccumulator): void {
  applyBackgroundPosition(target, value);
}

export function applyBackgroundOriginDecl(value: string, target: StyleAccumulator): void {
  applyBackgroundOrigin(target, value);
}

export function applyBackgroundRepeatDecl(value: string, target: StyleAccumulator): void {
  applyBackgroundRepeat(target, value);
}

export function applyBackgroundClipDecl(value: string, target: StyleAccumulator): void {
  const layers = ensureLayers(target);
  if (layers.length === 0) {
    return;
  }

  const tokens = value
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return;
  }

  for (let i = 0; i < tokens.length; i++) {
    const clipValue = tokens[i] as BackgroundClip;
    if (!BACKGROUND_CLIP_VALUES.has(clipValue)) {
      continue;
    }
    const layerIndex = Math.min(i, layers.length - 1);
    const layer = layers[layerIndex];
    if (layer) {
      layer.clip = clipValue as BackgroundClip;
    }
  }
}

export function parseBackgroundImage(value: string, target: StyleAccumulator): void {
  const trimmed = value.trim();

  // Try to parse gradients first
  const gradient = parseLinearGradient(value) ?? parseRadialGradient(value);
  if (gradient) {
    if (!target.backgroundLayers) {
      target.backgroundLayers = [];
    }
    target.backgroundLayers.push({ kind: "gradient", gradient });
    return;
  }

  // If not a gradient, treat as direct url
  if (trimmed.startsWith('url(')) {
    if (!target.backgroundLayers) {
      target.backgroundLayers = [];
    }
    target.backgroundLayers.push({
      kind: "image",
      url: trimmed,
      position: { x: "left", y: "top" },
      size: "auto",
      repeat: "repeat"
    });
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
