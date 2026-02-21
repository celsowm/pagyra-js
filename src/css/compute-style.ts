// src/css/compute-style.ts

import { type CssRuleEntry } from "../html/css/parse-css.js";
import { type UnitParsers } from "../units/units.js";
import type { SvgElement } from "../types/core.js";
import {
  ComputedStyle,
  type StyleAccumulator,
} from "./style.js";
import { ElementSpecificDefaults, BrowserDefaults } from "./browser-defaults.js";
import { applyDeclarationsToStyle } from "./apply-declarations.js";
import { log } from "../logging/debug.js";
import { StyleInheritanceResolver } from "./style-inheritance.js";
import { resolveDeclarationsForElement } from "./compute-style/declarations.js";
import { resolveDisplayForElement } from "./compute-style/display.js";
import { applyStyleInitOverrides } from "./compute-style/overrides.js";
import { applyTextDecorationOptions } from "./compute-style/decoration.js";
import { resolveDefaultsForComputedStyle } from "./compute-style/defaults.js";
import { computeFontContext } from "./compute-style/font.js";
import { mapFloatToMode } from "./compute-style/float.js";
import { createBaseStyleOptions } from "./compute-style/base-options.js";

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
  const { resolvedDeclarations, customProperties } = resolveDeclarationsForElement(
    element,
    cssRules,
    parentStyle.customProperties,
  );

  // Apply declarations to style accumulator
  applyDeclarationsToStyle(resolvedDeclarations, styleInit, units, inherited.fontWeight ?? mergedDefaults.fontWeight);

  const display = resolveDisplayForElement(tagName, styleInit.display, mergedDefaults.display);

  const floatValue = mapFloatToMode(styleInit.float);

  // Build final style options with proper precedence:
  // 1. Base browser defaults
  // 2. Element-specific defaults
  // 3. Inherited values
  // 4. CSS rules
  // 5. Inline styles
  const fontContext = computeFontContext(
    tagName,
    styleInit,
    inherited,
    elementDefaults,
    baseDefaults,
    mergedDefaults,
    parentStyle.fontSize,
    rootFontSize,
  );

  const resolvedDefaults = resolveDefaultsForComputedStyle(
    mergedDefaults,
    fontContext.computedFontSize,
    fontContext.rootFontReference,
  );

  const styleOptions = createBaseStyleOptions(
    resolvedDefaults,
    inherited,
    fontContext,
    mergedDefaults,
    styleInit,
    display,
    floatValue,
    customProperties,
  );

  applyStyleInitOverrides(
    styleInit,
    styleOptions,
    mergedDefaults,
    fontContext.computedFontSize,
    fontContext.rootFontReference,
  );

  applyTextDecorationOptions(
    styleOptions,
    styleInit,
    inherited,
    mergedDefaults,
    elementDefaults,
  );

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
