import { createNormalLineHeight, lineHeightEquals, type LineHeightValue } from "../line-height.js";
import { resolveNumberLike, type NumericLength } from "../length.js";
import type { StyleAccumulator } from "../style.js";
import type { InheritedStyleProperties } from "../style-inheritance.js";
import type { StyleDefaults } from "../ua-defaults/types.js";

const RELATIVE_FONT_SIZE_TAG_SCALE: Record<string, number> = {
  small: 0.8,
  big: 1.2,
};

function numericLengthEquals(a: NumericLength | undefined, b: NumericLength | undefined): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }
  if (typeof a === "number" || typeof b === "number") {
    return a === b;
  }
  return a.kind === b.kind && a.unit === b.unit && a.value === b.value;
}

export interface FontComputationResult {
  rootFontReference: number;
  computedFontSize: number;
  lineHeightSource: LineHeightValue;
  elementDefinesFontWeight: boolean;
  elementDefinesFontStyle: boolean;
}

export function computeFontContext(
  tagName: string,
  styleInit: StyleAccumulator,
  inherited: InheritedStyleProperties,
  elementDefaults: StyleDefaults,
  baseDefaults: StyleDefaults,
  mergedDefaults: StyleDefaults,
  parentFontSize: number,
  rootFontSize?: number,
): FontComputationResult {
  const elementDefinesFontWeight = elementDefaults.fontWeight !== undefined;
  const elementDefinesFontStyle = elementDefaults.fontStyle !== undefined;
  const elementDefinesFontSize =
    elementDefaults.fontSize !== undefined &&
    !numericLengthEquals(elementDefaults.fontSize, baseDefaults.fontSize);

  const baseLineHeight = baseDefaults.lineHeight ?? createNormalLineHeight();
  const mergedLineHeight = mergedDefaults.lineHeight ?? baseLineHeight;
  const elementDefinesLineHeight = !lineHeightEquals(mergedLineHeight, baseLineHeight);

  const rootFontReference = rootFontSize ?? parentFontSize;

  let computedFontSize = inherited.fontSize;
  if (styleInit.fontSize !== undefined) {
    const resolvedFontSize = resolveNumberLike(styleInit.fontSize, inherited.fontSize, rootFontReference);
    if (resolvedFontSize !== undefined) {
      computedFontSize = resolvedFontSize;
    }
  } else {
    if (elementDefinesFontSize) {
      const resolvedFontSize = resolveNumberLike(mergedDefaults.fontSize, inherited.fontSize, rootFontReference);
      if (resolvedFontSize !== undefined) {
        computedFontSize = resolvedFontSize;
      }
    }
    const relativeScale = RELATIVE_FONT_SIZE_TAG_SCALE[tagName];
    if (relativeScale !== undefined) {
      computedFontSize = (inherited.fontSize ?? 16) * relativeScale;
    }
  }

  return {
    rootFontReference,
    computedFontSize,
    lineHeightSource: elementDefinesLineHeight ? mergedLineHeight : inherited.lineHeight,
    elementDefinesFontWeight,
    elementDefinesFontStyle,
  };
}
