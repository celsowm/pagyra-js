import type { StyleAccumulator, StyleProperties } from "../style.js";
import type { StyleDefaults } from "../ua-defaults/types.js";

export function applyTextDecorationOptions(
  styleOptions: Partial<StyleProperties>,
  styleInit: StyleAccumulator,
  inherited: {
    textDecorationLine?: string;
    textDecorationColor?: string;
    textDecorationStyle?: string;
  },
  mergedDefaults: StyleDefaults,
  elementDefaults: StyleDefaults,
): void {
  const defaultDecoration = mergedDefaults.textDecorationLine ?? "none";
  let decoration = inherited.textDecorationLine ?? defaultDecoration;
  if (elementDefaults.textDecorationLine !== undefined) {
    decoration = elementDefaults.textDecorationLine;
  }
  if (styleInit.textDecorationLine !== undefined) {
    decoration = styleInit.textDecorationLine;
  }
  styleOptions.textDecorationLine = decoration;

  let decorationColor =
    styleInit.textDecorationColor !== undefined
      ? normalizeTextDecorationColor(styleInit.textDecorationColor)
      : undefined;
  if (decorationColor === undefined) {
    decorationColor =
      elementDefaults.textDecorationColor !== undefined
        ? normalizeTextDecorationColor(elementDefaults.textDecorationColor)
        : undefined;
  }
  if (decorationColor === undefined && inherited.textDecorationColor !== undefined) {
    decorationColor = inherited.textDecorationColor;
  }
  if (decorationColor !== undefined) {
    styleOptions.textDecorationColor = decorationColor;
  }

  const defaultDecorationStyle = mergedDefaults.textDecorationStyle ?? "solid";
  let decorationStyle = inherited.textDecorationStyle ?? defaultDecorationStyle;
  if (elementDefaults.textDecorationStyle !== undefined) {
    decorationStyle = elementDefaults.textDecorationStyle;
  }
  if (styleInit.textDecorationStyle !== undefined) {
    decorationStyle = styleInit.textDecorationStyle;
  }
  styleOptions.textDecorationStyle = decorationStyle;
}

export function normalizeTextDecorationColor(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const lower = trimmed.toLowerCase();
  if (lower === "inherit") {
    return undefined;
  }
  if (lower === "initial") {
    return "currentcolor";
  }
  if (lower === "unset" || lower === "revert" || lower === "revert-layer") {
    return undefined;
  }
  return lower === "currentcolor" ? "currentcolor" : trimmed;
}
