// src/css/parsers/registry.ts

import type { StyleAccumulator } from "../style.js";
import type { UnitParsers } from "../../units/units.js";

export interface PropertyParser {
  (value: string, target: StyleAccumulator, units: UnitParsers, inheritedFontWeight?: number): void;
}

export const propertyParserRegistry = new Map<string, PropertyParser>();

export function registerPropertyParser(property: string, parser: PropertyParser): void {
  propertyParserRegistry.set(property, parser);
}

export function getPropertyParser(property: string): PropertyParser | undefined {
  return propertyParserRegistry.get(property);
}
