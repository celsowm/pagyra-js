import { resolveNumberLike, type NumericLength } from "../length.js";
import type { StyleProperties } from "../style.js";
import type { StyleDefaults } from "../ua-defaults/types.js";

export function resolveDefaultsForComputedStyle(
  defaults: StyleDefaults,
  fontSize: number,
  rootFontSize: number,
): Partial<StyleProperties> {
  const {
    fontSize: defaultFontSize,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    borderTop,
    borderRight,
    borderBottom,
    borderLeft,
    ...rest
  } = defaults;

  const resolved: Partial<StyleProperties> = { ...rest };
  const resolveNumeric = (value: NumericLength | undefined): number | undefined =>
    resolveNumberLike(value, fontSize, rootFontSize);

  if (defaultFontSize !== undefined) {
    resolved.fontSize = resolveNumeric(defaultFontSize) ?? fontSize;
  }
  if (marginTop !== undefined) resolved.marginTop = resolveNumeric(marginTop);
  if (marginRight !== undefined) resolved.marginRight = resolveNumeric(marginRight);
  if (marginBottom !== undefined) resolved.marginBottom = resolveNumeric(marginBottom);
  if (marginLeft !== undefined) resolved.marginLeft = resolveNumeric(marginLeft);
  if (paddingTop !== undefined) resolved.paddingTop = resolveNumeric(paddingTop);
  if (paddingRight !== undefined) resolved.paddingRight = resolveNumeric(paddingRight);
  if (paddingBottom !== undefined) resolved.paddingBottom = resolveNumeric(paddingBottom);
  if (paddingLeft !== undefined) resolved.paddingLeft = resolveNumeric(paddingLeft);
  if (borderTop !== undefined) resolved.borderTop = resolveNumeric(borderTop);
  if (borderRight !== undefined) resolved.borderRight = resolveNumeric(borderRight);
  if (borderBottom !== undefined) resolved.borderBottom = resolveNumeric(borderBottom);
  if (borderLeft !== undefined) resolved.borderLeft = resolveNumeric(borderLeft);

  return resolved;
}
