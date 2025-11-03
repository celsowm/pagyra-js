// src/css/parsers/display-flex-parser.ts

import {
  mapAlignContentValue,
  mapAlignItemsValue,
  mapAlignSelfValue,
  mapDisplay,
  mapJustifyContent,
  parseFlexDirectionValue,
} from "./flex-parser.js";
import type { StyleAccumulator } from "../style.js";
import type { UnitParsers } from "../../units/units.js";

export function parseDisplay(value: string, target: StyleAccumulator): void {
  target.display = mapDisplay(value);
}

export function parseJustifyContent(value: string, target: StyleAccumulator): void {
  const mapped = mapJustifyContent(value);
  if (mapped !== undefined) {
    target.justifyContent = mapped;
  }
}

export function parseAlignItems(value: string, target: StyleAccumulator): void {
  const mapped = mapAlignItemsValue(value);
  if (mapped !== undefined) {
    target.alignItems = mapped;
  }
}

export function parseAlignContent(value: string, target: StyleAccumulator): void {
  const mapped = mapAlignContentValue(value);
  if (mapped !== undefined) {
    target.alignContent = mapped;
  }
}

export function parseAlignSelf(value: string, target: StyleAccumulator): void {
  const mapped = mapAlignSelfValue(value);
  if (mapped !== undefined) {
    target.alignSelf = mapped;
  }
}

export function parseFlexDirection(value: string, target: StyleAccumulator): void {
  const mapped = parseFlexDirectionValue(value);
  if (mapped !== undefined) {
    target.flexDirection = mapped;
  }
}

export function parseFlexWrap(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase();
  if (normalized === "nowrap") {
    target.flexWrap = false;
  } else if (normalized === "wrap" || normalized === "wrap-reverse") {
    target.flexWrap = true;
  }
}
