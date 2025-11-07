// src/css/compute-style.ts

import { type DomEl, type CssRuleEntry } from "../html/css/parse-css.js";
import { type UnitParsers } from "../units/units.js";
import {
  ComputedStyle,
  type StyleProperties,
  type StyleAccumulator,
  type TrackDefinitionInput,
  type TrackSizeInput,
  type TrackDefinition,
  type TrackSize,
} from "./style.js";
import { resolveLengthInput, resolveNumberLike } from "./length.js";
import type { LengthInput, LengthLike, RelativeLength } from "./length.js";
import { ElementSpecificDefaults, BrowserDefaults } from "./browser-defaults.js";
import { applyDeclarationsToStyle } from "./apply-declarations.js";
import { normalizeFontWeight } from './font-weight.js';
import { FloatMode, Display } from "./enums.js";
import { log } from "../debug/log.js";
import { cloneLineHeight, lineHeightEquals, resolveLineHeightInput } from "./line-height.js";

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

function parseInlineStyle(style: string): Record<string, string> {
  console.log("parseInlineStyle - input:", style);
  const declarations: Record<string, string> = {};
  for (const part of style.split(";")) {
    const colonIndex = part.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const rawProperty = part.substring(0, colonIndex);
    const rawValue = part.substring(colonIndex + 1);
    const property = rawProperty.trim().toLowerCase();
    const value = rawValue.trim();
    console.log("parseInlineStyle - parsed property:", property, "value:", value);
    if (property) {
      declarations[property] = value;
    }
  }
  console.log("parseInlineStyle - result:", declarations);
  return declarations;
}

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
  log("STYLE", "TRACE", "defaultDisplayForTag", { tag, display });
  return display;
}

function resolveTrackSizeInputToAbsolute(track: TrackSizeInput, fontSize: number, rootFontSize: number): TrackSize {
  if (track.kind === "fixed") {
    return {
      kind: "fixed",
      size: resolveNumberLike(track.size, fontSize, rootFontSize) ?? 0,
    };
  }
  if (track.kind === "flex") {
    return {
      kind: "flex",
      flex: track.flex,
      min: resolveNumberLike(track.min, fontSize, rootFontSize),
      max: resolveNumberLike(track.max, fontSize, rootFontSize),
    };
  }
  return {
    kind: "auto",
    min: resolveNumberLike(track.min, fontSize, rootFontSize),
    max: resolveNumberLike(track.max, fontSize, rootFontSize),
  };
}

function resolveTrackDefinitionsInput(
  definitions: TrackDefinitionInput[] | undefined,
  fontSize: number,
  rootFontSize: number,
): TrackDefinition[] | undefined {
  if (!definitions) {
    return undefined;
  }
  return definitions.map((definition) => {
    if (definition.kind === "repeat") {
      return {
        kind: "repeat",
        count: definition.count,
        track: resolveTrackSizeInputToAbsolute(definition.track, fontSize, rootFontSize),
      };
    }
    if (definition.kind === "repeat-auto") {
      return {
        kind: "repeat-auto",
        mode: definition.mode,
        track: resolveTrackSizeInputToAbsolute(definition.track, fontSize, rootFontSize),
      };
    }
    return resolveTrackSizeInputToAbsolute(definition, fontSize, rootFontSize);
  });
}

export function computeStyleForElement(
  element: DomEl,
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
  const inherited = {
    color: parentStyle.color ?? mergedDefaults.color,
    fontSize: parentStyle.fontSize,
    lineHeight: cloneLineHeight(parentStyle.lineHeight),
    fontFamily: parentStyle.fontFamily ?? mergedDefaults.fontFamily,
    fontStyle: parentStyle.fontStyle ?? mergedDefaults.fontStyle,
    fontVariant: parentStyle.fontVariant ?? mergedDefaults.fontVariant,
    fontWeight: parentStyle.fontWeight ?? mergedDefaults.fontWeight,
    textDecorationLine: parentStyle.textDecorationLine ?? mergedDefaults.textDecorationLine,
    overflowWrap: parentStyle.overflowWrap ?? mergedDefaults.overflowWrap,
  };

  const styleInit: StyleAccumulator = {};
  const aggregated: Record<string, string> = {};

  // Apply CSS rules
  for (const rule of cssRules) {
    if (rule.match(element)) {
      log("STYLE","DEBUG","CSS rule matched", { selector: rule.selector, declarations: rule.declarations });
      if (rule.declarations.display) {
        log("STYLE","DEBUG","Display declaration found", { selector: rule.selector, display: rule.declarations.display });
      }
      // Normalize rule declarations to lowercase keys
      const normalizedRuleDeclarations: Record<string, string> = {};
      for (const [prop, value] of Object.entries(rule.declarations)) {
        normalizedRuleDeclarations[prop.toLowerCase()] = value;
      }
      Object.assign(aggregated, normalizedRuleDeclarations);
    }
  }

  // Apply inline styles (highest priority)
  console.log("computeStyleForElement - processing element:", element.tagName, "style attribute:", element.getAttribute("style"));
  const inlineStyle = parseInlineStyle(element.getAttribute("style") ?? "");
  if (Object.keys(inlineStyle).length > 0) {
    log("STYLE","DEBUG","inline style applied", { declarations: inlineStyle });
  }
  Object.assign(aggregated, inlineStyle);

  // Apply declarations to style accumulator
  applyDeclarationsToStyle(aggregated, styleInit, units, inherited.fontWeight ?? mergedDefaults.fontWeight);

  // Determine final display value
  const defaultDisplay = mergedDefaults.display ?? defaultDisplayForTag(tagName);
  let display = styleInit.display ?? defaultDisplay;

  log("STYLE", "DEBUG", "computeStyleForElement display", {
    tagName,
    styleInitDisplay: styleInit.display,
    defaultDisplay,
    finalDisplay: display
  });

  // Force correct display for table elements if they're not set correctly
  if (tagName === 'table') {
    if (display !== Display.Table) {
      log("STYLE", "DEBUG", "Forcing table display", { tagName, originalDisplay: display });
      display = Display.Table;
    }
  } else if (tagName === 'thead' || tagName === 'tbody' || tagName === 'tfoot') {
    if (display !== Display.TableRowGroup) {
      log("STYLE", "DEBUG", "Forcing table-row-group display", { tagName, originalDisplay: display });
      display = Display.TableRowGroup;
    }
  } else if (tagName === 'tr') {
    if (display !== Display.TableRow) {
      log("STYLE", "DEBUG", "Forcing table-row display", { tagName, originalDisplay: display });
      display = Display.TableRow;
    }
  } else if (tagName === 'td' || tagName === 'th') {
    if (display !== Display.TableCell) {
      log("STYLE", "DEBUG", "Forcing table-cell display", { tagName, originalDisplay: display });
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
  const elementDefinesFontSize = mergedDefaults.fontSize !== baseDefaults.fontSize;
  const elementDefinesLineHeight = !lineHeightEquals(mergedDefaults.lineHeight, baseDefaults.lineHeight);

  const styleOptions: Partial<StyleProperties> = {
    // Start with merged defaults
    ...mergedDefaults,
    // Override with inherited values
    color: inherited.color,
    fontSize: elementDefinesFontSize ? mergedDefaults.fontSize : inherited.fontSize,
    lineHeight: cloneLineHeight(
      elementDefinesLineHeight ? mergedDefaults.lineHeight : inherited.lineHeight,
    ),
    fontFamily: inherited.fontFamily,
    fontStyle: elementDefinesFontStyle ? mergedDefaults.fontStyle : inherited.fontStyle,
    fontWeight: elementDefinesFontWeight ? mergedDefaults.fontWeight : normalizeFontWeight(inherited.fontWeight),
    overflowWrap: inherited.overflowWrap,
    // Apply computed values
    display,
    float: floatValue ?? FloatMode.None,
    borderModel: styleInit.borderModel ?? mergedDefaults.borderModel,
  };

  const rootFontReference = rootFontSize ?? parentStyle.fontSize ?? mergedDefaults.fontSize;

  const baseFontSize = styleOptions.fontSize ?? inherited.fontSize ?? mergedDefaults.fontSize;
  let computedFontSize: number = baseFontSize;
  if (styleInit.fontSize !== undefined) {
    const resolvedFontSize = resolveNumberLike(styleInit.fontSize, inherited.fontSize, rootFontReference);
    if (resolvedFontSize !== undefined) {
      computedFontSize = resolvedFontSize;
    }
  }
  styleOptions.fontSize = computedFontSize;

  if (styleInit.lineHeight !== undefined) {
    styleOptions.lineHeight = resolveLineHeightInput(
      styleInit.lineHeight,
      computedFontSize,
      rootFontReference,
    );
  }

  const assignLength = (value: LengthInput | undefined, setter: (resolved: LengthLike) => void): void => {
    const resolved = resolveLengthInput(value, computedFontSize, rootFontReference);
    if (resolved !== undefined) {
      setter(resolved);
    }
  };
  const assignNumberLength = (value: number | RelativeLength | undefined, setter: (resolved: number) => void): void => {
    const resolved = resolveNumberLike(value, computedFontSize, rootFontReference);
    if (resolved !== undefined) {
      setter(resolved);
    }
  };

  if (styleInit.position !== undefined) styleOptions.position = styleInit.position;
  if (styleInit.top !== undefined) assignLength(styleInit.top, (v) => (styleOptions.top = v));
  if (styleInit.right !== undefined) assignLength(styleInit.right, (v) => (styleOptions.right = v));
  if (styleInit.bottom !== undefined) assignLength(styleInit.bottom, (v) => (styleOptions.bottom = v));
  if (styleInit.left !== undefined) assignLength(styleInit.left, (v) => (styleOptions.left = v));
  if (styleInit.zIndex !== undefined) styleOptions.zIndex = styleInit.zIndex;
  if (styleInit.color !== undefined) styleOptions.color = styleInit.color;
  if (styleInit.backgroundLayers !== undefined) styleOptions.backgroundLayers = styleInit.backgroundLayers;
  if (styleInit.borderColor !== undefined) styleOptions.borderColor = styleInit.borderColor;
  if (styleInit.boxShadows !== undefined) {
    const resolveShadowLength = (value: number | RelativeLength | undefined, clamp = false): number => {
      const resolved = resolveNumberLike(value, computedFontSize, rootFontReference);
      if (resolved === undefined) {
        return 0;
      }
      if (clamp && resolved < 0) {
        return 0;
      }
      return resolved;
    };
    styleOptions.boxShadows = styleInit.boxShadows.map((shadow) => ({
      inset: shadow.inset,
      offsetX: resolveShadowLength(shadow.offsetX),
      offsetY: resolveShadowLength(shadow.offsetY),
      blurRadius: resolveShadowLength(shadow.blurRadius, true),
      spreadRadius: resolveShadowLength(shadow.spreadRadius),
      color: shadow.color,
    }));
  }
  if (styleInit.fontFamily !== undefined) styleOptions.fontFamily = styleInit.fontFamily;
  if (styleInit.fontStyle !== undefined) styleOptions.fontStyle = styleInit.fontStyle;
  if (styleInit.fontVariant !== undefined) styleOptions.fontVariant = styleInit.fontVariant;
  if (styleInit.fontWeight !== undefined) styleOptions.fontWeight = normalizeFontWeight(styleInit.fontWeight);
  if (styleInit.overflowWrap !== undefined) styleOptions.overflowWrap = styleInit.overflowWrap;
  if (styleInit.marginTop !== undefined) assignLength(styleInit.marginTop, (v) => (styleOptions.marginTop = v));
  if (styleInit.marginRight !== undefined) assignLength(styleInit.marginRight, (v) => (styleOptions.marginRight = v));
  if (styleInit.marginBottom !== undefined) assignLength(styleInit.marginBottom, (v) => (styleOptions.marginBottom = v));
  if (styleInit.marginLeft !== undefined) assignLength(styleInit.marginLeft, (v) => (styleOptions.marginLeft = v));
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
    const resolved = resolveTrackDefinitionsInput(styleInit.trackListColumns, computedFontSize, rootFontReference);
    if (resolved) {
      styleOptions.trackListColumns = resolved;
    }
  }
  if (styleInit.trackListRows !== undefined) {
    const resolved = resolveTrackDefinitionsInput(styleInit.trackListRows, computedFontSize, rootFontReference);
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
  if (styleInit.objectFit !== undefined) {
    styleOptions.objectFit = styleInit.objectFit as StyleProperties["objectFit"];
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

  // Debug fontStyle for em and strong elements
  if (tagName === 'em' || tagName === 'strong') {
    const debugInfo = {
      tagName,
      elementDefaultsFontStyle: elementDefaults.fontStyle,
      mergedFontStyle: mergedDefaults.fontStyle,
      finalFontStyle: styleOptions.fontStyle
    };
    console.log("[FONTSTYLE] DEBUG:", debugInfo);
    log("STYLE", "DEBUG", "element fontStyle", debugInfo);
  }

  return new ComputedStyle(styleOptions);
}
