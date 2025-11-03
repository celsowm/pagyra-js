// src/css/apply-declarations.ts

import { getPropertyParser } from "./parsers/registry.js";
import { registerAllPropertyParsers } from "./parsers/register-parsers.js";
import { type StyleAccumulator } from "./style.js";
import { type UnitParsers } from "../units/units.js";

export { setViewportSize } from "./viewport.js";

// Initialize the property parsers registry
registerAllPropertyParsers();

// Define shorthand properties that should be applied before longhands
const SHORTHAND_PROPERTIES = new Set([
  "border",
  "border-color",
  "border-style",
  "border-width",
  "border-radius",
  "margin",
  "padding",
  "background",
  "font",
  "text-decoration",
  "flex",
  "gap"
]);

// Cache for frequently used parsers to reduce Map lookups
const parserCache = new Map<string, Function>();

function getCachedParser(property: string) {
  if (parserCache.has(property)) {
    return parserCache.get(property);
  }
  const parser = getPropertyParser(property);
  if (parser) {
    parserCache.set(property, parser);
  }
  return parser;
}

export function applyDeclarationsToStyle(
  declarations: Record<string, string>,
  target: StyleAccumulator,
  units: UnitParsers,
  inheritedFontWeight?: number
): void {
  // Pre-normalize declarations (lowercase keys and trim values)
  const normalizedDeclarations: Record<string, string> = {};
  for (const [property, value] of Object.entries(declarations)) {
    normalizedDeclarations[property.toLowerCase()] = value.trim();
  }

  // Separate shorthands and longhands
  const shorthands: Array<[string, string]> = [];
  const longhands: Array<[string, string]> = [];

  for (const [property, value] of Object.entries(normalizedDeclarations)) {
    if (SHORTHAND_PROPERTIES.has(property)) {
      shorthands.push([property, value]);
    } else {
      longhands.push([property, value]);
    }
  }

  // Pass 1: Apply shorthands first
  for (const [property, value] of shorthands) {
    const parser = getCachedParser(property);
    if (parser) {
      parser(value, target, units, inheritedFontWeight);
    } else {
      console.warn(`Unsupported CSS property: ${property}`);
    }
  }

  // Pass 2: Apply longhands (they can override shorthands)
  for (const [property, value] of longhands) {
    const parser = getCachedParser(property);
    if (parser) {
      parser(value, target, units, inheritedFontWeight);
    } else {
      console.warn(`Unsupported CSS property: ${property}`);
    }
  }
}
