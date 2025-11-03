// src/css/compute-style.ts

import { type DomEl, type CssRuleEntry } from "../html/css/parse-css.js";
import { type UnitParsers } from "../units/units.js";
import { ComputedStyle, type StyleProperties, type StyleAccumulator } from "./style.js";
import { ElementSpecificDefaults, BrowserDefaults } from "./browser-defaults.js";
import { applyDeclarationsToStyle } from "./apply-declarations.js";
import { normalizeFontWeight } from './font-weight.js';
import { FloatMode, Display } from "./enums.js";
import { log } from "../debug/log.js";

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

export function computeStyleForElement(
  element: DomEl,
  cssRules: CssRuleEntry[],
  parentStyle: ComputedStyle,
  units: UnitParsers
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
    lineHeight: parentStyle.lineHeight,
    fontFamily: parentStyle.fontFamily ?? mergedDefaults.fontFamily,
    fontStyle: parentStyle.fontStyle ?? mergedDefaults.fontStyle,
    fontWeight: parentStyle.fontWeight ?? mergedDefaults.fontWeight,
    textDecorationLine: parentStyle.textDecorationLine ?? mergedDefaults.textDecorationLine,
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
  const elementDefinesLineHeight = mergedDefaults.lineHeight !== baseDefaults.lineHeight;

  const styleOptions: Partial<StyleProperties> = {
    // Start with merged defaults
    ...mergedDefaults,
    // Override with inherited values
    color: inherited.color,
    fontSize: elementDefinesFontSize ? mergedDefaults.fontSize : inherited.fontSize,
    lineHeight: elementDefinesLineHeight ? mergedDefaults.lineHeight : inherited.lineHeight,
    fontFamily: inherited.fontFamily,
    fontStyle: elementDefinesFontStyle ? mergedDefaults.fontStyle : inherited.fontStyle,
    fontWeight: elementDefinesFontWeight ? mergedDefaults.fontWeight : normalizeFontWeight(inherited.fontWeight),
    // Apply computed values
    display,
    float: floatValue ?? FloatMode.None,
    borderModel: styleInit.borderModel ?? mergedDefaults.borderModel,
  };

  // Apply specific overrides from CSS/inline styles
  if (styleInit.color !== undefined) styleOptions.color = styleInit.color;
  if (styleInit.backgroundLayers !== undefined) styleOptions.backgroundLayers = styleInit.backgroundLayers;
  if (styleInit.borderColor !== undefined) styleOptions.borderColor = styleInit.borderColor;
  if (styleInit.boxShadows !== undefined) styleOptions.boxShadows = [...styleInit.boxShadows];
  if (styleInit.fontSize !== undefined) styleOptions.fontSize = styleInit.fontSize;
  if (styleInit.lineHeight !== undefined) styleOptions.lineHeight = styleInit.lineHeight;
  if (styleInit.fontFamily !== undefined) styleOptions.fontFamily = styleInit.fontFamily;
  if (styleInit.fontStyle !== undefined) styleOptions.fontStyle = styleInit.fontStyle;
  if (styleInit.fontWeight !== undefined) styleOptions.fontWeight = normalizeFontWeight(styleInit.fontWeight);
  if (styleInit.marginTop !== undefined) styleOptions.marginTop = styleInit.marginTop;
  if (styleInit.marginRight !== undefined) styleOptions.marginRight = styleInit.marginRight;
  if (styleInit.marginBottom !== undefined) styleOptions.marginBottom = styleInit.marginBottom;
  if (styleInit.marginLeft !== undefined) styleOptions.marginLeft = styleInit.marginLeft;
  if (styleInit.paddingTop !== undefined) styleOptions.paddingTop = styleInit.paddingTop;
  if (styleInit.paddingRight !== undefined) styleOptions.paddingRight = styleInit.paddingRight;
  if (styleInit.paddingBottom !== undefined) styleOptions.paddingBottom = styleInit.paddingBottom;
  if (styleInit.paddingLeft !== undefined) styleOptions.paddingLeft = styleInit.paddingLeft;
  if (styleInit.borderTop !== undefined) styleOptions.borderTop = styleInit.borderTop;
  if (styleInit.borderRight !== undefined) styleOptions.borderRight = styleInit.borderRight;
  if (styleInit.borderBottom !== undefined) styleOptions.borderBottom = styleInit.borderBottom;
  if (styleInit.borderLeft !== undefined) styleOptions.borderLeft = styleInit.borderLeft;
  if (styleInit.borderTopLeftRadiusX !== undefined) styleOptions.borderTopLeftRadiusX = styleInit.borderTopLeftRadiusX;
  if (styleInit.borderTopLeftRadiusY !== undefined) styleOptions.borderTopLeftRadiusY = styleInit.borderTopLeftRadiusY;
  if (styleInit.borderTopRightRadiusX !== undefined) styleOptions.borderTopRightRadiusX = styleInit.borderTopRightRadiusX;
  if (styleInit.borderTopRightRadiusY !== undefined) styleOptions.borderTopRightRadiusY = styleInit.borderTopRightRadiusY;
  if (styleInit.borderBottomRightRadiusX !== undefined) styleOptions.borderBottomRightRadiusX = styleInit.borderBottomRightRadiusX;
  if (styleInit.borderBottomRightRadiusY !== undefined) styleOptions.borderBottomRightRadiusY = styleInit.borderBottomRightRadiusY;
  if (styleInit.borderBottomLeftRadiusX !== undefined) styleOptions.borderBottomLeftRadiusX = styleInit.borderBottomLeftRadiusX;
  if (styleInit.borderBottomLeftRadiusY !== undefined) styleOptions.borderBottomLeftRadiusY = styleInit.borderBottomLeftRadiusY;
  if (styleInit.width !== undefined) styleOptions.width = styleInit.width;
  if (styleInit.minWidth !== undefined) styleOptions.minWidth = styleInit.minWidth;
  if (styleInit.maxWidth !== undefined) styleOptions.maxWidth = styleInit.maxWidth;
  if (styleInit.height !== undefined) styleOptions.height = styleInit.height;
  if (styleInit.minHeight !== undefined) styleOptions.minHeight = styleInit.minHeight;
  if (styleInit.maxHeight !== undefined) styleOptions.maxHeight = styleInit.maxHeight;
  if (styleInit.trackListColumns !== undefined) {
    styleOptions.trackListColumns = [...styleInit.trackListColumns];
  }
  if (styleInit.trackListRows !== undefined) {
    styleOptions.trackListRows = [...styleInit.trackListRows];
  }
  if (styleInit.autoFlow !== undefined) {
    styleOptions.autoFlow = styleInit.autoFlow;
  }
  if (styleInit.rowGap !== undefined) {
    styleOptions.rowGap = styleInit.rowGap;
  }
  if (styleInit.columnGap !== undefined) {
    styleOptions.columnGap = styleInit.columnGap;
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

