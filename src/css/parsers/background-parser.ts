import type { BackgroundLayer, BackgroundSize } from "../background-types.js";
import { parseLinearGradient, type LinearGradient } from "./gradient-parser.js";

/**
 * Ensures background layers array exists and returns the top renderable layer
 */
function ensureLayers(style: any): BackgroundLayer[] {
  if (!style.backgroundLayers) {
    style.backgroundLayers = [];
  }
  return style.backgroundLayers;
}

/**
 * Gets or creates the top renderable layer (skips color-only layers)
 */
function getOrCreateTopRenderableLayer(style: any): BackgroundLayer {
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
  console.log("parseSingleBackgroundLayer - input:", trimmed);
  if (!trimmed) return null;

  // Handle gradients
  if (trimmed.toLowerCase().includes('linear-gradient(') ||
      trimmed.toLowerCase().includes('radial-gradient(') ||
      trimmed.toLowerCase().includes('conic-gradient(')) {
    console.log("parseSingleBackgroundLayer - detected gradient:", trimmed);
    const result = parseGradientLayer(trimmed);
    console.log("parseSingleBackgroundLayer - gradient result:", result);
    return result;
  }

  // Handle colors
  if (isColorValue(trimmed)) {
    console.log("parseSingleBackgroundLayer - detected color:", trimmed);
    return { kind: "color", color: trimmed };
  }

  // Handle images with properties
  console.log("parseSingleBackgroundLayer - parsing as image:", trimmed);
  return parseImageLayer(trimmed);
}

/**
 * Parses gradient background layer
 */
function parseGradientLayer(value: string): BackgroundLayer | null {
  // For now, we'll handle linear gradients
  if (value.toLowerCase().startsWith('linear-gradient(')) {
    const gradient = parseLinearGradient(value);
    if (gradient) {
      return {
        kind: "gradient",
        gradient: gradient
      };
    }
  }

  return null;
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
  let repeat = "repeat";
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
    const part = parts[currentIndex];

    // Check for size (contains /)
    if (part.includes('/')) {
      size = parseBackgroundSizeValue(part);
      currentIndex++;
    }
    // Check for position keywords
    else if (isPositionKeyword(part)) {
      position = parseBackgroundPosition(part, parts[currentIndex + 1]);
      currentIndex += position.y !== "top" ? 2 : 1;
    }
    // Check for repeat keywords
    else if (isRepeatKeyword(part)) {
      repeat = part;
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
    repeat: repeat as any
  };
}

/**
 * Parses background-size value
 */
function parseBackgroundSizeValue(value: string): BackgroundSize {
  // Split on '/' as independent token, not within tokens
  const slashIndex = value.indexOf('/');
  if (slashIndex === -1) {
    const v = value.trim().toLowerCase();
    if (v === "cover" || v === "contain" || v === "auto") {
      return v;
    }
    return { width: value.trim(), height: "auto" };
  } else {
    const width = value.substring(0, slashIndex).trim();
    const height = value.substring(slashIndex + 1).trim();
    return {
      width: width || "auto",
      height: height || "auto"
    };
  }
}

/**
 * Parses background-position value
 */
function parseBackgroundPosition(x: string, y?: string): { x: string; y: string } {
  const posX = x.toLowerCase();
  const posY = y?.toLowerCase() || "top";

  // Handle single keywords that apply to both
  if (posX === "center") {
    return { x: "center", y: "center" };
  }

  return { x: posX, y: posY };
}

/**
 * Checks if value is a color
 */
function isColorValue(value: string): boolean {
  // Simple color detection - can be enhanced
  const colorKeywords = ['transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'gray', 'silver', 'maroon', 'purple', 'fuchsia', 'lime', 'olive', 'navy', 'teal', 'aqua'];
  const lowerValue = value.toLowerCase();

  if (colorKeywords.includes(lowerValue)) return true;
  if (lowerValue.startsWith('#') && (lowerValue.length === 4 || lowerValue.length === 7)) return true;
  if (lowerValue.startsWith('rgb(') || lowerValue.startsWith('rgba(')) return true;
  if (lowerValue.startsWith('hsl(') || lowerValue.startsWith('hsla(')) return true;

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
 * Applies background-size longhand property
 */
export function applyBackgroundSize(style: any, value: string): void {
  ensureLayers(style);
  const layer = getOrCreateTopRenderableLayer(style);
  const tokens = value.trim().split(/\s+/);
  let size: BackgroundSize;

  if (tokens.length === 1) {
    const v = tokens[0].toLowerCase();
    size = v === "cover" || v === "contain" || v === "auto"
      ? v
      : { width: tokens[0], height: "auto" };
  } else {
    size = { width: tokens[0], height: tokens[1] ?? "auto" };
  }

  if (layer.kind === "image") {
    layer.size = size;
  }
}
