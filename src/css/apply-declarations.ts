// src/css/apply-declarations.ts

import { getPropertyParser, type PropertyParser } from "./parsers/registry.js";
import { registerAllPropertyParsers } from "./parsers/register-parsers.js";
import { registerWhiteSpaceParser } from "./parsers/white-space-parser.js";
import { registerFragmentationParsers } from "./parsers/fragmentation-parser.js";
import { registerVisibilityParser } from "./parsers/visibility-parser.js";
import { registerObjectPositionParser } from "./parsers/object-position-parser.js";
import { type StyleAccumulator } from "./style.js";
import { type UnitParsers } from "../units/units.js";

export { setViewportSize } from "./viewport.js";

export interface ApplicableDeclaration {
  property: string;
  value: string;
}

registerAllPropertyParsers();
registerWhiteSpaceParser();
registerFragmentationParsers();
registerVisibilityParser();
registerObjectPositionParser();

const parserCache = new Map<string, PropertyParser>();

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

function applyDeclarationToStyle(
  declaration: ApplicableDeclaration,
  target: StyleAccumulator,
  units: UnitParsers,
  inheritedFontWeight?: number,
): void {
  const property = declaration.property.startsWith("--")
    ? declaration.property
    : declaration.property.toLowerCase();
  const value = declaration.value.trim();
  const parser = getCachedParser(property);
  if (parser) {
    parser(value, target, units, inheritedFontWeight);
  } else if (!property.startsWith("--")) {
    console.warn(`Unsupported CSS property: ${property}`);
  }
}

export function applyOrderedDeclarationsToStyle(
  declarations: readonly ApplicableDeclaration[],
  target: StyleAccumulator,
  units: UnitParsers,
  inheritedFontWeight?: number,
): void {
  for (const declaration of declarations) {
    applyDeclarationToStyle(declaration, target, units, inheritedFontWeight);
  }
}

export function applyDeclarationsToStyle(
  declarations: Record<string, string>,
  target: StyleAccumulator,
  units: UnitParsers,
  inheritedFontWeight?: number,
): void {
  applyOrderedDeclarationsToStyle(
    Object.entries(declarations).map(([property, value]) => ({ property, value })),
    target,
    units,
    inheritedFontWeight,
  );
}
