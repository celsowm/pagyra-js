// src/css/apply-declarations.ts

import { getPropertyParser } from "./parsers/registry.js";
import { registerAllPropertyParsers } from "./parsers/register-parsers.js";
import { type StyleAccumulator } from "./style.js";
import { type UnitParsers } from "../units/units.js";

export { setViewportSize } from "./viewport.js";

// Initialize the property parsers registry
registerAllPropertyParsers();

export function applyDeclarationsToStyle(
  declarations: Record<string, string>,
  target: StyleAccumulator,
  units: UnitParsers,
  inheritedFontWeight?: number
): void {
  for (const [property, value] of Object.entries(declarations)) {
    const parser = getPropertyParser(property);
    if (parser) {
      parser(value, target, units, inheritedFontWeight);
    } else {
      // Log de propriedade não suportada (opcional)
      console.warn(`Unsupported CSS property: ${property}`);
    }
  }
}
