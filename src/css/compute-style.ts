// src/css/compute-style.ts

import { type CssRuleEntry } from "../html/css/parse-css.js";
import { type UnitParsers } from "../units/units.js";
import type { SvgElement } from "../types/core.js";
import {
  ComputedStyle,
  type StyleProperties,
  type StyleAccumulator,
} from "./style.js";
import { resolveNumberLike, type LengthInput, type LengthLike, type NumericLength } from "./length.js";
import { ElementSpecificDefaults, BrowserDefaults } from "./browser-defaults.js";
import { applyDeclarationsToStyle } from "./apply-declarations.js";
import { normalizeFontWeight } from './font-weight.js';
import { BoxSizing, FloatMode, Display } from "./enums.js";
import { log } from "../logging/debug.js";
import { cloneLineHeight, createNormalLineHeight, lineHeightEquals, resolveLineHeightInput } from "./line-height.js";
import { parseInlineStyle } from "./inline-style-parser.js";
import { StyleInheritanceResolver } from "./style-inheritance.js";
import { CssUnitResolver } from "./css-unit-resolver.js";
import { LayoutPropertyResolver } from "./layout-property-resolver.js";
import type { StyleDefaults } from "./ua-defaults/types.js";
import {
  CustomPropertiesMap,
  extractCustomProperties,
  resolveDeclarationsWithVariables,
} from "./custom-properties.js";

function mapFloat(value: string | undefined): FloatMode | undefined {
  switch (value) {
    case "left":
      return FloatMode.Left;
    case "right":
      return FloatMode.Right;
    case "none":
      return FloatMode.None;
    default:
      return undefined;
  }
}

// parseInlineStyle now imported from inline-style-parser.ts

function defaultDisplayForTag(tag: string): Display {
  let display: Display;
  switch (tag) {
    case "span":
    case "a":
    case "strong":
    case "em":
    case "b":
    case "s":
    case "strike":
    case "del":
    case "label":
    case "code":
    case "small":
    case "time":
    case "i":
    case "u":
    case "sub":
    case "sup":
    case "mark":
    case "abbr":
    case "cite":
    case "dfn":
    case "kbd":
    case "q":
    case "tt":
      display = Display.Inline;
      break;
    case "table":
      display = Display.Table;
      break;
    case "tbody":
    case "thead":
    case "tfoot":
      display = Display.TableRowGroup;
      break;
    case "tr":
      display = Display.TableRow;
      break;
    case "td":
    case "th":
      display = Display.TableCell;
      break;
    case "caption":
      display = Display.TableCaption;
      break;
    case "div":
    case "section":
    case "main":
    case "article":
    case "header":
    case "footer":
    case "nav":
    case "p":
    case "ul":
    case "ol":
    case "li":
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      display = Display.Block;
      break;
    default:
      display = Display.Block;
      break;
  }
  log("style", "trace", "defaultDisplayForTag", { tag, display });
  return display;
}

const RELATIVE_FONT_SIZE_TAG_SCALE: Record<string, number> = {
  small: 0.8,
  big: 1.2,
};

function resolveDefaultsForComputedStyle(
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

// resolveTrackSizeInputToAbsolute and resolveTrackDefinitionsInput now in layout-property-resolver.ts

export function computeStyleForElement(
  element: SvgElement,
  cssRules: CssRuleEntry[],
  parentStyle: ComputedStyle,
  units: UnitParsers,
  rootFontSize?: number,
): ComputedStyle {
  const tagName = element.tagName.toLowerCase();

  // Get element-specific defaults from browser defaults system
  const elementDefaults = ElementSpecificDefaults.getDefaultsForElement(tagName);

  // Create base style with browser defaults
  const baseDefaults = BrowserDefaults.createBaseDefaults();

  // Merge element-specific defaults with base defaults
  const mergedDefaults = BrowserDefaults.mergeElementDefaults(baseDefaults, elementDefaults);

  // Apply inheritance from parent
  const inherited = StyleInheritanceResolver.resolveInheritedProperties(parentStyle, mergedDefaults);

  const styleInit: StyleAccumulator = {};
  const aggregated: Record<string, string> = {};

  // Apply CSS rules
  for (const rule of cssRules) {
    if (rule.match(element)) {
      log("style", "debug", "CSS rule matched", { selector: rule.selector, declarations: rule.declarations });
      if (rule.declarations.display) {
        log("style", "debug", "Display declaration found", { selector: rule.selector, display: rule.declarations.display });
      }
      // Normalize rule declarations to lowercase keys (except custom properties which are case-sensitive)
      const normalizedRuleDeclarations: Record<string, string> = {};
      for (const [prop, value] of Object.entries(rule.declarations)) {
        if (prop.startsWith('--')) {
          normalizedRuleDeclarations[prop] = value;
        } else {
          normalizedRuleDeclarations[prop.toLowerCase()] = value;
        }
      }
      Object.assign(aggregated, normalizedRuleDeclarations);
    }
  }

  // Apply inline styles (highest priority)
  const inlineStyle = parseInlineStyle(element.getAttribute("style") ?? "");
  if (Object.keys(inlineStyle).length > 0) {
    log("style", "debug", "inline style applied", { declarations: inlineStyle });
  }
  Object.assign(aggregated, inlineStyle);

  // === CSS Custom Properties (CSS Variables) Support ===

  // 1. Inherit custom properties from parent
  let customProperties = parentStyle.customProperties
    ? parentStyle.customProperties.clone()
    : new CustomPropertiesMap();

  // 2. Extract and merge custom properties from this element's declarations
  const elementCustomProps = extractCustomProperties(aggregated);
  customProperties = elementCustomProps.inherit(customProperties);

  log("style", "debug", "custom properties", {
    count: customProperties.size,
    keys: customProperties.keys()
  });

  // 3. Resolve var() references in all declarations
  const resolvedDeclarations = resolveDeclarationsWithVariables(aggregated, customProperties);

  // Apply declarations to style accumulator
  applyDeclarationsToStyle(resolvedDeclarations, styleInit, units, inherited.fontWeight ?? mergedDefaults.fontWeight);

  // Determine final display value
  const defaultDisplay = mergedDefaults.display ?? defaultDisplayForTag(tagName);
  let display = styleInit.display ?? defaultDisplay;

  log("style", "debug", "computeStyleForElement display", {
    tagName,
    styleInitDisplay: styleInit.display,
    defaultDisplay,
    finalDisplay: display
  });

  // Force correct display for table elements if they're not set correctly
  if (tagName === 'table') {
    if (display !== Display.Table) {
      log("style", "debug", "Forcing table display", { tagName, originalDisplay: display });
      display = Display.Table;
    }
  } else if (tagName === 'thead' || tagName === 'tbody' || tagName === 'tfoot') {
    if (display !== Display.TableRowGroup) {
      log("style", "debug", "Forcing table-row-group display", { tagName, originalDisplay: display });
      display = Display.TableRowGroup;
    }
  } else if (tagName === 'tr') {
    if (display !== Display.TableRow) {
      log("style", "debug", "Forcing table-row display", { tagName, originalDisplay: display });
      display = Display.TableRow;
    }
  } else if (tagName === 'td' || tagName === 'th') {
    if (display !== Display.TableCell) {
      log("style", "debug", "Forcing table-cell display", { tagName, originalDisplay: display });
      display = Display.TableCell;
    }
  }

  const floatValue = mapFloat(styleInit.float);

  // Build final style options with proper precedence:
  // 1. Base browser defaults
  // 2. Element-specific defaults
  // 3. Inherited values
  // 4. CSS rules
  // 5. Inline styles (already applied in aggregated)
  const elementDefinesFontWeight = elementDefaults.fontWeight !== undefined;
  const elementDefinesFontStyle = elementDefaults.fontStyle !== undefined;
  const baseLineHeight = baseDefaults.lineHeight ?? createNormalLineHeight();
  const mergedLineHeight = mergedDefaults.lineHeight ?? baseLineHeight;
  const elementDefinesLineHeight = !lineHeightEquals(mergedLineHeight, baseLineHeight);

  const rootFontReference = rootFontSize ?? parentStyle.fontSize;

  const baseFontSize = inherited.fontSize;
  let computedFontSize: number = baseFontSize;
  if (styleInit.fontSize !== undefined) {
    const resolvedFontSize = resolveNumberLike(styleInit.fontSize, inherited.fontSize, rootFontReference);
    if (resolvedFontSize !== undefined) {
      computedFontSize = resolvedFontSize;
    }
  } else {
    const resolvedFontSize = resolveNumberLike(mergedDefaults.fontSize, inherited.fontSize, rootFontReference);
    if (resolvedFontSize !== undefined) {
      computedFontSize = resolvedFontSize;
    }
    const relativeScale = RELATIVE_FONT_SIZE_TAG_SCALE[tagName];
    if (relativeScale !== undefined) {
      computedFontSize = (inherited.fontSize ?? 16) * relativeScale;
    }
  }

  const resolvedDefaults = resolveDefaultsForComputedStyle(mergedDefaults, computedFontSize, rootFontReference);

  const styleOptions: Partial<StyleProperties> & { customProperties?: CustomPropertiesMap } = {
    customProperties,
    // Start with merged defaults
    ...resolvedDefaults,
    // Override with inherited values
    color: inherited.color,
    fontSize: computedFontSize,
    lineHeight: cloneLineHeight(
      elementDefinesLineHeight ? mergedLineHeight : inherited.lineHeight,
    ),
    fontFamily: inherited.fontFamily,
    fontStyle: elementDefinesFontStyle ? mergedDefaults.fontStyle : inherited.fontStyle,
    fontWeight: elementDefinesFontWeight ? mergedDefaults.fontWeight : normalizeFontWeight(inherited.fontWeight),
    overflowWrap: inherited.overflowWrap,
    textIndent: inherited.textIndent ?? mergedDefaults.textIndent ?? 0,
    textTransform: inherited.textTransform ?? "none",
    letterSpacing: inherited.letterSpacing ?? mergedDefaults.letterSpacing,
    listStyleType: inherited.listStyleType ?? mergedDefaults.listStyleType ?? "disc",
    // Apply computed values
    display,
    float: floatValue ?? FloatMode.None,
    borderModel: styleInit.borderModel ?? mergedDefaults.borderModel,
  };

  if (styleInit.lineHeight !== undefined) {
    styleOptions.lineHeight = resolveLineHeightInput(
      styleInit.lineHeight,
      computedFontSize,
      rootFontReference,
    );
  }

  // Create unit resolver with computed font sizes
  const unitResolver = new CssUnitResolver(computedFontSize, rootFontReference);
  const assignLength = (value: LengthInput, setter: (resolved: LengthLike) => void): void => {
    unitResolver.createLengthAssigner(setter)(value);
  };
  const assignNumberLength = (value: NumericLength, setter: (resolved: number) => void): void => {
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
  if (styleInit.marginTop !== undefined) assignLength(styleInit.marginTop, (v) => (styleOptions.marginTop = v));
  else styleOptions.marginTop = resolveNumberLike(mergedDefaults.marginTop, computedFontSize, rootFontReference);
  if (styleInit.marginRight !== undefined) assignLength(styleInit.marginRight, (v) => (styleOptions.marginRight = v));
  else styleOptions.marginRight = resolveNumberLike(mergedDefaults.marginRight, computedFontSize, rootFontReference);
  if (styleInit.marginBottom !== undefined) assignLength(styleInit.marginBottom, (v) => (styleOptions.marginBottom = v));
  else styleOptions.marginBottom = resolveNumberLike(mergedDefaults.marginBottom, computedFontSize, rootFontReference);
  if (styleInit.marginLeft !== undefined) assignLength(styleInit.marginLeft, (v) => (styleOptions.marginLeft = v));
  else styleOptions.marginLeft = resolveNumberLike(mergedDefaults.marginLeft, computedFontSize, rootFontReference);
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
    const resolved = LayoutPropertyResolver.resolveTrackDefinitionsInput(styleInit.trackListColumns, computedFontSize, rootFontReference);
    if (resolved) {
      styleOptions.trackListColumns = resolved;
    }
  }
  if (styleInit.trackListRows !== undefined) {
    const resolved = LayoutPropertyResolver.resolveTrackDefinitionsInput(styleInit.trackListRows, computedFontSize, rootFontReference);
    if (resolved) {
      styleOptions.trackListRows = resolved;
    }
  }
  if (styleInit.autoFlow !== undefined) {
    styleOptions.autoFlow = styleInit.autoFlow;
  }
  if (styleInit.rowGap !== undefined) {
    assignNumberLength(styleInit.rowGap, (v) => (styleOptions.rowGap = v));
  }
  if (styleInit.columnGap !== undefined) {
    assignNumberLength(styleInit.columnGap, (v) => (styleOptions.columnGap = v));
  }
  if (styleInit.justifyContent !== undefined) styleOptions.justifyContent = styleInit.justifyContent;
  if (styleInit.alignItems !== undefined) styleOptions.alignItems = styleInit.alignItems;
  if (styleInit.alignContent !== undefined) styleOptions.alignContent = styleInit.alignContent;
  if (styleInit.alignSelf !== undefined) styleOptions.alignSelf = styleInit.alignSelf;
  if (styleInit.flexDirection !== undefined) styleOptions.flexDirection = styleInit.flexDirection;
  if (styleInit.flexWrap !== undefined) styleOptions.flexWrap = styleInit.flexWrap;
  if (styleInit.textAlign !== undefined) styleOptions.textAlign = styleInit.textAlign;
  if (styleInit.textIndent !== undefined) assignLength(styleInit.textIndent, (v) => (styleOptions.textIndent = v));
  if (styleInit.textTransform !== undefined) styleOptions.textTransform = styleInit.textTransform;
  if (styleInit.letterSpacing !== undefined) assignNumberLength(styleInit.letterSpacing, (v) => (styleOptions.letterSpacing = v));
  if (styleInit.listStyleType !== undefined) styleOptions.listStyleType = styleInit.listStyleType;
  // If a raw transform string was parsed, preserve it on the computed style so downstream
  // consumers (e.g. text run builders / renderers) can apply mapping for text.
  if (styleInit.transform !== undefined) {
    styleOptions.transform = styleInit.transform;
  }
  if (styleInit.objectFit !== undefined) {
    styleOptions.objectFit = styleInit.objectFit as StyleProperties["objectFit"];
  }
  if (styleInit.opacity !== undefined) {
    styleOptions.opacity = styleInit.opacity;
  }

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

  // Debug fontStyle for em and strong elements
  if (tagName === 'em' || tagName === 'strong') {
    const debugInfo = {
      tagName,
      elementDefaultsFontStyle: elementDefaults.fontStyle,
      mergedFontStyle: mergedDefaults.fontStyle,
      finalFontStyle: styleOptions.fontStyle
    };
    log("style", "debug", "element fontStyle", debugInfo);
  }

  return new ComputedStyle(styleOptions);
}

function normalizeTextDecorationColor(value: string | undefined): string | undefined {
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
