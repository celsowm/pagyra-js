import { FloatMode, type Display } from "../enums.js";
import { normalizeFontWeight } from "../font-weight.js";
import { cloneLineHeight } from "../line-height.js";
import type { StyleAccumulator, StyleProperties } from "../style.js";
import type { InheritedStyleProperties } from "../style-inheritance.js";
import type { StyleDefaults } from "../ua-defaults/types.js";
import type { FontComputationResult } from "./font.js";
import type { CustomPropertiesMap } from "../custom-properties.js";

export function createBaseStyleOptions(
  resolvedDefaults: Partial<StyleProperties>,
  inherited: InheritedStyleProperties,
  fontContext: FontComputationResult,
  mergedDefaults: StyleDefaults,
  styleInit: StyleAccumulator,
  display: Display,
  floatMode: FloatMode | undefined,
  customProperties: CustomPropertiesMap,
): Partial<StyleProperties> {
  return {
    customProperties,
    ...resolvedDefaults,
    color: inherited.color,
    fontSize: fontContext.computedFontSize,
    lineHeight: cloneLineHeight(fontContext.lineHeightSource),
    fontFamily: inherited.fontFamily,
    fontStyle: fontContext.elementDefinesFontStyle ? mergedDefaults.fontStyle : inherited.fontStyle,
    fontWeight: fontContext.elementDefinesFontWeight ? mergedDefaults.fontWeight : normalizeFontWeight(inherited.fontWeight),
    overflowWrap: inherited.overflowWrap,
    textIndent: inherited.textIndent ?? mergedDefaults.textIndent ?? 0,
    textTransform: inherited.textTransform ?? "none",
    letterSpacing: inherited.letterSpacing ?? mergedDefaults.letterSpacing,
    listStyleType: inherited.listStyleType ?? mergedDefaults.listStyleType ?? "disc",
    display,
    float: floatMode ?? FloatMode.None,
    borderModel: styleInit.borderModel ?? mergedDefaults.borderModel,
  };
}
