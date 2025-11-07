import type { ElementDefaults } from "./types.js";
import { createBaseDefaultsObject } from "./base-defaults.js";
import { cloneLineHeight } from "../line-height.js";

/**
 * Factory + merge utilities for browser-like UA defaults.
 * This module is responsible only for:
 * - creating the base defaults object
 * - merging element-specific overrides into it
 */
export class BrowserDefaults {
  static createBaseDefaults(): any {
    return createBaseDefaultsObject();
  }

  static mergeElementDefaults(baseDefaults: any, elementDefaults: Partial<ElementDefaults>): any {
    const merged = { ...baseDefaults };

    if (elementDefaults.fontSize !== undefined) {
      merged.fontSize = elementDefaults.fontSize;
    }
    if (elementDefaults.fontStyle !== undefined) {
      merged.fontStyle = elementDefaults.fontStyle;
    }
    if (elementDefaults.lineHeight !== undefined) {
      merged.lineHeight = cloneLineHeight(elementDefaults.lineHeight);
    }
    if (elementDefaults.fontFamily !== undefined) {
      merged.fontFamily = elementDefaults.fontFamily;
    }
    if (elementDefaults.fontWeight !== undefined) {
      merged.fontWeight = elementDefaults.fontWeight;
    }
    if (elementDefaults.color !== undefined) {
      merged.color = elementDefaults.color;
    }
    if (elementDefaults.borderColor !== undefined) {
      merged.borderColor = elementDefaults.borderColor;
    }

    if (elementDefaults.margin !== undefined) {
      merged.marginTop = elementDefaults.margin;
      merged.marginRight = elementDefaults.margin;
      merged.marginBottom = elementDefaults.margin;
      merged.marginLeft = elementDefaults.margin;
    }
    if (elementDefaults.marginTop !== undefined) {
      merged.marginTop = elementDefaults.marginTop;
    }
    if (elementDefaults.marginRight !== undefined) {
      merged.marginRight = elementDefaults.marginRight;
    }
    if (elementDefaults.marginBottom !== undefined) {
      merged.marginBottom = elementDefaults.marginBottom;
    }
    if (elementDefaults.marginLeft !== undefined) {
      merged.marginLeft = elementDefaults.marginLeft;
    }

    if (elementDefaults.padding !== undefined) {
      merged.paddingTop = elementDefaults.padding;
      merged.paddingRight = elementDefaults.padding;
      merged.paddingBottom = elementDefaults.padding;
      merged.paddingLeft = elementDefaults.padding;
    }
    if (elementDefaults.paddingTop !== undefined) {
      merged.paddingTop = elementDefaults.paddingTop;
    }
    if (elementDefaults.paddingRight !== undefined) {
      merged.paddingRight = elementDefaults.paddingRight;
    }
    if (elementDefaults.paddingBottom !== undefined) {
      merged.paddingBottom = elementDefaults.paddingBottom;
    }
    if (elementDefaults.paddingLeft !== undefined) {
      merged.paddingLeft = elementDefaults.paddingLeft;
    }

    if (elementDefaults.border !== undefined) {
      merged.borderTop = elementDefaults.border;
      merged.borderRight = elementDefaults.border;
      merged.borderBottom = elementDefaults.border;
      merged.borderLeft = elementDefaults.border;
    }
    if (elementDefaults.borderTop !== undefined) {
      merged.borderTop = elementDefaults.borderTop;
    }
    if (elementDefaults.borderRight !== undefined) {
      merged.borderRight = elementDefaults.borderRight;
    }
    if (elementDefaults.borderBottom !== undefined) {
      merged.borderBottom = elementDefaults.borderBottom;
    }
    if (elementDefaults.borderLeft !== undefined) {
      merged.borderLeft = elementDefaults.borderLeft;
    }

    if (elementDefaults.display !== undefined) {
      merged.display = elementDefaults.display;
    }
    if (elementDefaults.objectFit !== undefined) {
      (merged as any).objectFit = elementDefaults.objectFit;
    }
    if (elementDefaults.textAlign !== undefined) {
      merged.textAlign = elementDefaults.textAlign;
    }
    if (elementDefaults.textIndent !== undefined) {
      (merged as any).textIndent = elementDefaults.textIndent;
    }
    if (elementDefaults.verticalAlign !== undefined) {
      merged.verticalAlign = elementDefaults.verticalAlign;
    }
    if (elementDefaults.listStyleType !== undefined) {
      merged.listStyleType = elementDefaults.listStyleType;
    }
    if (elementDefaults.textDecorationLine !== undefined) {
      (merged as any).textDecorationLine = elementDefaults.textDecorationLine;
    }
    if (elementDefaults.overflowWrap !== undefined) {
      (merged as any).overflowWrap = elementDefaults.overflowWrap;
    }
    if (elementDefaults.borderCollapse !== undefined) {
      merged.borderCollapse = elementDefaults.borderCollapse;
    }
    if (elementDefaults.borderSpacing !== undefined) {
      merged.borderSpacing = elementDefaults.borderSpacing;
    }

    return merged;
  }
}
