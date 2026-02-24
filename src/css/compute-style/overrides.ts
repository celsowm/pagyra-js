import { BoxSizing } from "../enums.js";
import type { StyleAccumulator, StyleProperties } from "../style.js";
import { normalizeFontWeight } from "../font-weight.js";
import { CssUnitResolver } from "../css-unit-resolver.js";
import { LayoutPropertyResolver } from "../layout-property-resolver.js";
import { resolveLineHeightInput } from "../line-height.js";
import {
  isClampNumericLength,
  resolveClampNumericLength,
  resolveNumberLike,
  type ClampNumericLength,
  type LengthInput,
  type LengthLike,
  type NumericLength,
} from "../length.js";
import type { StyleDefaults } from "../ua-defaults/types.js";

function assignMarginWithFallback(
  styleValue: LengthInput | undefined,
  fallbackValue: NumericLength | undefined,
  fontSize: number,
  rootFontSize: number,
  assignLength: (value: LengthInput, setter: (resolved: LengthLike) => void) => void,
  setter: (resolved: LengthLike) => void,
): void {
  if (styleValue !== undefined) {
    assignLength(styleValue, setter);
    return;
  }
  const resolvedFallback = resolveNumberLike(fallbackValue, fontSize, rootFontSize);
  if (resolvedFallback !== undefined) {
    setter(resolvedFallback);
  }
}

export function applyStyleInitOverrides(
  styleInit: StyleAccumulator,
  styleOptions: Partial<StyleProperties>,
  mergedDefaults: StyleDefaults,
  computedFontSize: number,
  rootFontReference: number,
): void {
  if (styleInit.lineHeight !== undefined) {
    styleOptions.lineHeight = resolveLineHeightInput(
      styleInit.lineHeight,
      computedFontSize,
      rootFontReference,
    );
  }

  const unitResolver = new CssUnitResolver(computedFontSize, rootFontReference);
  const assignLength = (value: LengthInput, setter: (resolved: LengthLike) => void): void => {
    unitResolver.createLengthAssigner(setter)(value);
  };
  const assignNumberLength = (value: NumericLength, setter: (resolved: number) => void): void => {
    unitResolver.createNumberAssigner(setter)(value);
  };
  const assignGapLength = (value: NumericLength | ClampNumericLength, setter: (resolved: number) => void): void => {
    if (isClampNumericLength(value)) {
      const resolved = resolveClampNumericLength(value, computedFontSize, rootFontReference);
      if (resolved !== undefined) {
        setter(resolved);
      }
      return;
    }
    unitResolver.createNumberAssigner(setter)(value);
  };

  if (styleInit.boxSizing !== undefined) {
    styleOptions.boxSizing = styleInit.boxSizing === "border-box" ? BoxSizing.BorderBox : BoxSizing.ContentBox;
  }
  if (styleInit.position !== undefined) styleOptions.position = styleInit.position;
  if (styleInit.top !== undefined) assignLength(styleInit.top, (v) => (styleOptions.top = v));
  if (styleInit.right !== undefined) assignLength(styleInit.right, (v) => (styleOptions.right = v));
  if (styleInit.bottom !== undefined) assignLength(styleInit.bottom, (v) => (styleOptions.bottom = v));
  if (styleInit.left !== undefined) assignLength(styleInit.left, (v) => (styleOptions.left = v));
  if (styleInit.zIndex !== undefined) styleOptions.zIndex = styleInit.zIndex;
  if (styleInit.color !== undefined) styleOptions.color = styleInit.color;
  if (styleInit.backgroundLayers !== undefined) styleOptions.backgroundLayers = styleInit.backgroundLayers;
  if (styleInit.clipPath !== undefined) styleOptions.clipPath = styleInit.clipPath;
  if (styleInit.borderColor !== undefined) styleOptions.borderColor = styleInit.borderColor;
  if (styleInit.borderStyleTop !== undefined) styleOptions.borderStyleTop = styleInit.borderStyleTop;
  if (styleInit.borderStyleRight !== undefined) styleOptions.borderStyleRight = styleInit.borderStyleRight;
  if (styleInit.borderStyleBottom !== undefined) styleOptions.borderStyleBottom = styleInit.borderStyleBottom;
  if (styleInit.borderStyleLeft !== undefined) styleOptions.borderStyleLeft = styleInit.borderStyleLeft;
  if (styleInit.boxShadows !== undefined) {
    styleOptions.boxShadows = styleInit.boxShadows.map((shadow) => ({
      inset: shadow.inset,
      offsetX: unitResolver.resolveShadowLength(shadow.offsetX),
      offsetY: unitResolver.resolveShadowLength(shadow.offsetY),
      blurRadius: unitResolver.resolveShadowLength(shadow.blurRadius, true),
      spreadRadius: unitResolver.resolveShadowLength(shadow.spreadRadius),
      color: shadow.color,
    }));
  }
  if (styleInit.textShadows !== undefined) {
    styleOptions.textShadows = styleInit.textShadows.map((shadow) => ({
      offsetX: unitResolver.resolveShadowLength(shadow.offsetX),
      offsetY: unitResolver.resolveShadowLength(shadow.offsetY),
      blurRadius: unitResolver.resolveShadowLength(shadow.blurRadius, true),
      color: shadow.color,
    }));
  }
  if (styleInit.fontFamily !== undefined) styleOptions.fontFamily = styleInit.fontFamily;
  if (styleInit.fontStyle !== undefined) styleOptions.fontStyle = styleInit.fontStyle;
  if (styleInit.fontVariant !== undefined) styleOptions.fontVariant = styleInit.fontVariant;
  if (styleInit.fontWeight !== undefined) styleOptions.fontWeight = normalizeFontWeight(styleInit.fontWeight);
  if (styleInit.overflowWrap !== undefined) styleOptions.overflowWrap = styleInit.overflowWrap;
  if (styleInit.content !== undefined) styleOptions.content = styleInit.content;
  if (styleInit.counterReset !== undefined) styleOptions.counterReset = [...styleInit.counterReset];
  if (styleInit.counterIncrement !== undefined) styleOptions.counterIncrement = [...styleInit.counterIncrement];

  assignMarginWithFallback(
    styleInit.marginTop,
    mergedDefaults.marginTop,
    computedFontSize,
    rootFontReference,
    assignLength,
    (v) => (styleOptions.marginTop = v),
  );
  assignMarginWithFallback(
    styleInit.marginRight,
    mergedDefaults.marginRight,
    computedFontSize,
    rootFontReference,
    assignLength,
    (v) => (styleOptions.marginRight = v),
  );
  assignMarginWithFallback(
    styleInit.marginBottom,
    mergedDefaults.marginBottom,
    computedFontSize,
    rootFontReference,
    assignLength,
    (v) => (styleOptions.marginBottom = v),
  );
  assignMarginWithFallback(
    styleInit.marginLeft,
    mergedDefaults.marginLeft,
    computedFontSize,
    rootFontReference,
    assignLength,
    (v) => (styleOptions.marginLeft = v),
  );

  if (styleInit.paddingTop !== undefined) assignLength(styleInit.paddingTop, (v) => (styleOptions.paddingTop = v));
  if (styleInit.paddingRight !== undefined) assignLength(styleInit.paddingRight, (v) => (styleOptions.paddingRight = v));
  if (styleInit.paddingBottom !== undefined) assignLength(styleInit.paddingBottom, (v) => (styleOptions.paddingBottom = v));
  if (styleInit.paddingLeft !== undefined) assignLength(styleInit.paddingLeft, (v) => (styleOptions.paddingLeft = v));
  if (styleInit.borderTop !== undefined) assignLength(styleInit.borderTop, (v) => (styleOptions.borderTop = v));
  if (styleInit.borderRight !== undefined) assignLength(styleInit.borderRight, (v) => (styleOptions.borderRight = v));
  if (styleInit.borderBottom !== undefined) assignLength(styleInit.borderBottom, (v) => (styleOptions.borderBottom = v));
  if (styleInit.borderLeft !== undefined) assignLength(styleInit.borderLeft, (v) => (styleOptions.borderLeft = v));
  if (styleInit.borderTopLeftRadiusX !== undefined)
    assignNumberLength(styleInit.borderTopLeftRadiusX, (v) => (styleOptions.borderTopLeftRadiusX = v));
  if (styleInit.borderTopLeftRadiusY !== undefined)
    assignNumberLength(styleInit.borderTopLeftRadiusY, (v) => (styleOptions.borderTopLeftRadiusY = v));
  if (styleInit.borderTopRightRadiusX !== undefined)
    assignNumberLength(styleInit.borderTopRightRadiusX, (v) => (styleOptions.borderTopRightRadiusX = v));
  if (styleInit.borderTopRightRadiusY !== undefined)
    assignNumberLength(styleInit.borderTopRightRadiusY, (v) => (styleOptions.borderTopRightRadiusY = v));
  if (styleInit.borderBottomRightRadiusX !== undefined)
    assignNumberLength(styleInit.borderBottomRightRadiusX, (v) => (styleOptions.borderBottomRightRadiusX = v));
  if (styleInit.borderBottomRightRadiusY !== undefined)
    assignNumberLength(styleInit.borderBottomRightRadiusY, (v) => (styleOptions.borderBottomRightRadiusY = v));
  if (styleInit.borderBottomLeftRadiusX !== undefined)
    assignNumberLength(styleInit.borderBottomLeftRadiusX, (v) => (styleOptions.borderBottomLeftRadiusX = v));
  if (styleInit.borderBottomLeftRadiusY !== undefined)
    assignNumberLength(styleInit.borderBottomLeftRadiusY, (v) => (styleOptions.borderBottomLeftRadiusY = v));
  if (styleInit.width !== undefined) assignLength(styleInit.width, (v) => (styleOptions.width = v));
  if (styleInit.minWidth !== undefined) assignLength(styleInit.minWidth, (v) => (styleOptions.minWidth = v));
  if (styleInit.maxWidth !== undefined) assignLength(styleInit.maxWidth, (v) => (styleOptions.maxWidth = v));
  if (styleInit.height !== undefined) assignLength(styleInit.height, (v) => (styleOptions.height = v));
  if (styleInit.minHeight !== undefined) assignLength(styleInit.minHeight, (v) => (styleOptions.minHeight = v));
  if (styleInit.maxHeight !== undefined) assignLength(styleInit.maxHeight, (v) => (styleOptions.maxHeight = v));
  if (styleInit.trackListColumns !== undefined) {
    const resolved = LayoutPropertyResolver.resolveTrackDefinitionsInput(
      styleInit.trackListColumns,
      computedFontSize,
      rootFontReference,
    );
    if (resolved) {
      styleOptions.trackListColumns = resolved;
    }
  }
  if (styleInit.trackListRows !== undefined) {
    const resolved = LayoutPropertyResolver.resolveTrackDefinitionsInput(
      styleInit.trackListRows,
      computedFontSize,
      rootFontReference,
    );
    if (resolved) {
      styleOptions.trackListRows = resolved;
    }
  }
  if (styleInit.autoFlow !== undefined) {
    styleOptions.autoFlow = styleInit.autoFlow;
  }
  if (styleInit.rowGap !== undefined) {
    assignGapLength(styleInit.rowGap, (v) => (styleOptions.rowGap = v));
  }
  if (styleInit.columnGap !== undefined) {
    assignGapLength(styleInit.columnGap, (v) => (styleOptions.columnGap = v));
  }
  if (styleInit.gridColumnSpan !== undefined) {
    styleOptions.gridColumnSpan = styleInit.gridColumnSpan;
  }
  if (styleInit.justifyContent !== undefined) styleOptions.justifyContent = styleInit.justifyContent;
  if (styleInit.alignItems !== undefined) styleOptions.alignItems = styleInit.alignItems;
  if (styleInit.alignContent !== undefined) styleOptions.alignContent = styleInit.alignContent;
  if (styleInit.alignSelf !== undefined) styleOptions.alignSelf = styleInit.alignSelf;
  if (styleInit.flexDirection !== undefined) styleOptions.flexDirection = styleInit.flexDirection;
  if (styleInit.flexWrap !== undefined) styleOptions.flexWrap = styleInit.flexWrap;
  if (styleInit.flexGrow !== undefined) styleOptions.flexGrow = styleInit.flexGrow;
  if (styleInit.flexShrink !== undefined) styleOptions.flexShrink = styleInit.flexShrink;
  if (styleInit.flexBasis !== undefined) assignLength(styleInit.flexBasis, (v) => (styleOptions.flexBasis = v));
  if (styleInit.textAlign !== undefined) styleOptions.textAlign = styleInit.textAlign;
  if (styleInit.textIndent !== undefined) assignLength(styleInit.textIndent, (v) => (styleOptions.textIndent = v));
  if (styleInit.textTransform !== undefined) styleOptions.textTransform = styleInit.textTransform;
  if (styleInit.letterSpacing !== undefined) assignNumberLength(styleInit.letterSpacing, (v) => (styleOptions.letterSpacing = v));
  if (styleInit.listStyleType !== undefined) styleOptions.listStyleType = styleInit.listStyleType;
  if (styleInit.transform !== undefined) {
    styleOptions.transform = styleInit.transform;
  }
  if (styleInit.objectFit !== undefined) {
    styleOptions.objectFit = styleInit.objectFit as StyleProperties["objectFit"];
  }
  if (styleInit.opacity !== undefined) {
    styleOptions.opacity = styleInit.opacity;
  }
}
