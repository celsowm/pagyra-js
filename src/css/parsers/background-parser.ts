import type {
  BackgroundLayer,
  BackgroundOrigin,
  BackgroundPosition,
  BackgroundRepeat,
  BackgroundSize,
  GradientBackgroundLayer,
} from "../background-types.js";
import { parseLinearGradient, parseRadialGradient } from "./gradient-parser.js";
import { NAMED_COLORS } from "../named-colors.js";
import type { StyleAccumulator } from "../style.js";

function normalizeBackgroundSizeKeyword(value: string): "cover" | "contain" | "auto" | undefined {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }

  const matchesKeyword = (keyword: "cover" | "contain" | "auto") => {
    return (
      trimmed === keyword ||
      trimmed.startsWith(`${keyword} `) ||
      trimmed.startsWith(`${keyword}(`)
    );
  };

  if (matchesKeyword("cover")) {
    return "cover";
  }
  if (matchesKeyword("contain")) {
    return "contain";
  }
  if (matchesKeyword("auto")) {
    return "auto";
  }
  return undefined;
}

function normalizeBackgroundSizeComponent(value: string): string {
  const keyword = normalizeBackgroundSizeKeyword(value);
  return keyword ?? value.trim();
}

interface FunctionSlice {
  text: string;
  start: number;
  end: number;
}

function extractFunctionCall(value: string, fnName: string): FunctionSlice | null {
  const lower = value.toLowerCase();
  const needle = `${fnName.toLowerCase()}(`;
  const start = lower.indexOf(needle);
  if (start === -1) {
    return null;
  }
  let depth = 0;
  for (let i = start; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) {
        return { text: value.slice(start, i + 1), start, end: i + 1 };
      }
    }
  }
  return null;
}

/**
 * Ensures background layers array exists and returns the top renderable layer
 */
export function ensureLayers(style: StyleAccumulator): BackgroundLayer[] {
  if (!style.backgroundLayers) {
    style.backgroundLayers = [];
  }
  return style.backgroundLayers;
}

/**
 * Gets or creates the top renderable layer (skips color-only layers)
 */
function getOrCreateTopRenderableLayer(style: StyleAccumulator): BackgroundLayer {
  const layers = ensureLayers(style);

  // Find the last non-color layer
  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i].kind !== 'color') {
      return layers[i];
    }
  }

  // If no renderable layer exists, create an image layer
  const newLayer: BackgroundLayer = { kind: "image", url: "" };
  layers.push(newLayer);
  return newLayer;
}

/**
 * Parses background shorthand property
 */
export function parseBackgroundShorthand(value: string): BackgroundLayer[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  // Split by commas to handle multiple layers, but be careful with commas inside functions like gradients
  const layerStrings = splitBackgroundLayers(trimmed);
  const layers: BackgroundLayer[] = [];

  for (const layerStr of layerStrings) {
    const layer = parseSingleBackgroundLayer(layerStr);
    if (layer) {
      layers.push(layer);
    }
  }

  return layers;
}

function splitBackgroundLayers(value: string): string[] {
  const result: string[] = [];
  let current = '';
  let parenCount = 0;
  let i = 0;

  while (i < value.length) {
    const char = value[i];

    if (char === '(') {
      parenCount++;
      current += char;
    } else if (char === ')') {
      parenCount--;
      current += char;
    } else if (char === ',' && parenCount === 0) {
      // Only split on commas that are not inside parentheses
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    i++;
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

/**
 * Parses a single background layer
 */
function parseSingleBackgroundLayer(value: string): BackgroundLayer | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Handle gradients
  const gradientSlice =
    extractFunctionCall(trimmed, "radial-gradient") ??
    extractFunctionCall(trimmed, "linear-gradient");
  if (gradientSlice) {
    const gradientLayer = parseGradientLayer(gradientSlice.text);
    if (gradientLayer) {
      const before = trimmed.slice(0, gradientSlice.start).trim();
      const after = trimmed.slice(gradientSlice.end).trim();
      const remainder = [before, after].filter(Boolean).join(" ");
      if (remainder && gradientLayer.kind === "gradient") {
        const tokens = remainder.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
          const lower = token.toLowerCase();
          if (isRepeatKeyword(lower)) {
            gradientLayer.repeat = lower as BackgroundRepeat;
          } else if (isBoxKeyword(lower)) {
            gradientLayer.origin = lower as BackgroundOrigin;
          }
        }
      }
      return gradientLayer;
    }
  }

  // Handle colors
  if (isColorValue(trimmed)) {
    return { kind: "color", color: trimmed };
  }

  // Handle images with properties
  return parseImageLayer(trimmed);
}

/**
 * Parses gradient background layer
 */
function parseGradientLayer(value: string): GradientBackgroundLayer | null {
  const normalized = value.trim().toLowerCase();
  const gradient =
    normalized.startsWith("linear-gradient(") ? parseLinearGradient(value) :
    normalized.startsWith("radial-gradient(") ? parseRadialGradient(value) :
    null;
  if (!gradient) {
    return null;
  }
  return {
    kind: "gradient",
    gradient,
  };
}

/**
 * Parses image background layer with properties
 */
function parseImageLayer(value: string): BackgroundLayer | null {
  const parts = value.split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) return null;

  let url = "";
  let position: { x: string; y: string } = { x: "left", y: "top" };
  let size: BackgroundSize = "auto";
  let repeat: BackgroundRepeat = "repeat";
  let origin: BackgroundOrigin | undefined;
  let currentIndex = 0;

  // Find URL first
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith('url(')) {
      url = parts[i];
      currentIndex = i + 1;
      break;
    }
  }

  if (!url) return null;

  // Parse remaining properties
  while (currentIndex < parts.length) {
    const partRaw = parts[currentIndex];
    const part = partRaw.toLowerCase();

    // Check for size (contains /)
    if (part.includes("/")) {
      size = parseBackgroundSizeValue(partRaw);
      currentIndex++;
    }
    // Check for position keywords
    else if (isPositionKeyword(part)) {
      position = parseBackgroundPosition(part, parts[currentIndex + 1]);
      currentIndex += position.y !== "top" ? 2 : 1;
    }
    // Check for repeat keywords
    else if (isRepeatKeyword(part)) {
      repeat = part as BackgroundRepeat;
      currentIndex++;
    }
    // Check for background-origin keywords (box)
    else if (isBoxKeyword(part) && origin === undefined) {
      origin = part as BackgroundOrigin;
      currentIndex++;
    }
    else {
      currentIndex++;
    }
  }

  return {
    kind: "image",
    url,
    position,
    size,
    repeat: repeat,
    origin,
  };
}

/**
 * Parses background-size value
 */
function parseBackgroundSizeValue(value: string): BackgroundSize {
  // Split on '/' as independent token, not within tokens
  const slashIndex = value.indexOf('/');
  if (slashIndex === -1) {
    const keyword = normalizeBackgroundSizeKeyword(value);
    if (keyword) {
      return keyword;
    }
    const tokens = value.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      return { width: normalizeBackgroundSizeComponent(tokens[0]), height: "auto" };
    }
    return {
      width: normalizeBackgroundSizeComponent(tokens[0]),
      height: normalizeBackgroundSizeComponent(tokens[1] ?? "auto"),
    };
  } else {
    const width = value.substring(0, slashIndex).trim();
    const height = value.substring(slashIndex + 1).trim();
    return {
      width: width ? normalizeBackgroundSizeComponent(width) : "auto",
      height: height ? normalizeBackgroundSizeComponent(height) : "auto"
    };
  }
}

/**
 * Parses background-position value
 */
const VERTICAL_POSITION_KEYWORDS = new Set(["top", "bottom"]);

function parseBackgroundPosition(x: string, y: string): { x: string; y: string } {
  return {
    x: x.toLowerCase(),
    y: y.toLowerCase(),
  };
}

/**
 * Checks if value is a color
 */
function isColorValue(value: string): boolean {
  const lowerValue = value.toLowerCase();
  if (lowerValue in NAMED_COLORS) {
    return true;
  }
  if (lowerValue === "transparent") {
    return true;
  }
  if (lowerValue.startsWith("#") && (lowerValue.length === 4 || lowerValue.length === 5 || lowerValue.length === 7 || lowerValue.length === 9)) {
    return true;
  }
  if (lowerValue.startsWith("rgb(") || lowerValue.startsWith("rgba(")) {
    return true;
  }
  if (lowerValue.startsWith("hsl(") || lowerValue.startsWith("hsla(")) {
    return true;
  }
  return false;
}

/**
 * Checks if value is a position keyword
 */
function isPositionKeyword(value: string): boolean {
  const positions = ['left', 'center', 'right', 'top', 'bottom'];
  return positions.includes(value.toLowerCase());
}

/**
 * Checks if value is a repeat keyword
 */
function isRepeatKeyword(value: string): boolean {
  const repeats = ['repeat', 'repeat-x', 'repeat-y', 'no-repeat', 'space', 'round'];
  return repeats.includes(value.toLowerCase());
}

/**
 * Checks if value is a background box keyword used by background-origin/background-clip
 */
function isBoxKeyword(value: string): value is BackgroundOrigin {
  const lower = value.toLowerCase();
  return lower === "border-box" || lower === "padding-box" || lower === "content-box";
}

/**
 * Applies background-size longhand property
 */
export function applyBackgroundSize(style: StyleAccumulator, value: string): void {
  ensureLayers(style);
  const layer = getOrCreateTopRenderableLayer(style);
  const keyword = normalizeBackgroundSizeKeyword(value);
  let size: BackgroundSize;

  if (keyword) {
    size = keyword;
  } else {
    const tokens = value.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      size = "auto";
    } else if (tokens.length === 1) {
      size = { width: normalizeBackgroundSizeComponent(tokens[0]), height: "auto" };
    } else {
      size = {
        width: normalizeBackgroundSizeComponent(tokens[0]),
        height: normalizeBackgroundSizeComponent(tokens[1] ?? "auto"),
      };
    }
  }

  if (layer.kind === "image" || layer.kind === "gradient") {
    layer.size = size;
  }
}

function parseBackgroundPositionValue(value: string): BackgroundPosition {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { x: "left", y: "top" };
  }

  const normalizedTokens = tokens.map((token) => token.toLowerCase());
  const first = normalizedTokens[0];

  if (tokens.length === 1) {
    if (first === "center") {
      return parseBackgroundPosition("center", "center");
    }
    if (VERTICAL_POSITION_KEYWORDS.has(first)) {
      return parseBackgroundPosition("center", first);
    }
    return parseBackgroundPosition(first, "center");
  }

  const second = normalizedTokens[1];
  const firstIsVertical = VERTICAL_POSITION_KEYWORDS.has(first);

  if (firstIsVertical) {
    const horizontalToken = tokens[1] ?? "center";
    return parseBackgroundPosition(horizontalToken, first);
  }

  return parseBackgroundPosition(first, second ?? "center");
}

export function applyBackgroundPosition(style: StyleAccumulator, value: string): void {
  ensureLayers(style);
  const layer = getOrCreateTopRenderableLayer(style);
  const position = parseBackgroundPositionValue(value);
  if (layer.kind === "image" || layer.kind === "gradient") {
    layer.position = position;
  }
}

export function applyBackgroundOrigin(style: StyleAccumulator, value: string): void {
  ensureLayers(style);
  const token = value.trim().toLowerCase();
  if (!isBoxKeyword(token)) {
    return;
  }
  const layer = getOrCreateTopRenderableLayer(style);
  if (layer.kind === "image" || layer.kind === "gradient") {
    layer.origin = token;
  }
}

export function applyBackgroundRepeat(style: StyleAccumulator, value: string): void {
  ensureLayers(style);
  const token = value.trim().toLowerCase();
  if (!isRepeatKeyword(token)) {
    return;
  }
  const layer = getOrCreateTopRenderableLayer(style);
  if (layer.kind === "image" || layer.kind === "gradient") {
    layer.repeat = token as BackgroundRepeat;
  }
}
