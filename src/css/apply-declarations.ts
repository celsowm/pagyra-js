// src/css/apply-declarations.ts

import { BorderModel } from "./enums.js";
import { parseFontWeightValue } from "./font-weight.js";
import {
  parseBorderCornerRadius,
  parseBorderRadiusShorthand,
  parseBorderWidth,
} from "./parsers/border-parser.js";
import { parseBoxShadowList } from "./parsers/box-shadow-parser.js";
import {
  mapAlignContentValue,
  mapAlignItemsValue,
  mapAlignSelfValue,
  mapDisplay,
  mapJustifyContent,
  parseFlexDirectionValue,
} from "./parsers/flex-parser.js";
import { parseLength, parseLineHeight, parseNumeric } from "./parsers/length-parser.js";
import { parseLinearGradient } from "./parsers/gradient-parser.js";
import { parseTextDecorationLine } from "./parsers/text-parser.js";
import {
  applyBorderColorShorthand,
  applyBorderStyleShorthand,
  applyBorderShorthand,
  isNoneBorderStyle,
} from "./shorthands/border-shorthand.js";
import { applyBoxShorthand } from "./shorthands/box-shorthand.js";
import { type StyleAccumulator } from "./style.js";
import { type UnitParsers } from "../units/units.js";

export { setViewportSize } from "./viewport.js";

export function applyDeclarationsToStyle(
  declarations: Record<string, string>,
  target: StyleAccumulator,
  units: UnitParsers,
  inheritedFontWeight?: number
): void {
  for (const [property, value] of Object.entries(declarations)) {
    switch (property) {
      case "display":
        target.display = mapDisplay(value);
        break;
      case "justify-content": {
        const mapped = mapJustifyContent(value);
        if (mapped !== undefined) {
          target.justifyContent = mapped;
        }
        break;
      }
      case "align-items": {
        const mapped = mapAlignItemsValue(value);
        if (mapped !== undefined) {
          target.alignItems = mapped;
        }
        break;
      }
      case "align-content": {
        const mapped = mapAlignContentValue(value);
        if (mapped !== undefined) {
          target.alignContent = mapped;
        }
        break;
      }
      case "align-self": {
        const mapped = mapAlignSelfValue(value);
        if (mapped !== undefined) {
          target.alignSelf = mapped;
        }
        break;
      }
      case "flex-direction": {
        const mapped = parseFlexDirectionValue(value);
        if (mapped !== undefined) {
          target.flexDirection = mapped;
        }
        break;
      }
      case "flex-wrap": {
        const normalized = value.trim().toLowerCase();
        if (normalized === "nowrap") {
          target.flexWrap = false;
        } else if (normalized === "wrap" || normalized === "wrap-reverse") {
          target.flexWrap = true;
        }
        break;
      }
      case "color":
        target.color = value;
        break;
      case "background-color":
        if (!target.backgroundLayers) {
          target.backgroundLayers = [];
        }
        target.backgroundLayers.push({ kind: "color", color: value });
        break;
      case "border-color":
        applyBorderColorShorthand(value, (color) => {
          target.borderColor = color;
        });
        break;
      case "box-shadow": {
        const parsed = parseBoxShadowList(value);
        if (parsed !== undefined) {
          target.boxShadows = parsed;
        }
        break;
      }
      case "border":
        applyBorderShorthand(value, (width) => {
          target.borderTop = width;
          target.borderRight = width;
          target.borderBottom = width;
          target.borderLeft = width;
        }, (color) => {
          target.borderColor = color ?? target.borderColor;
        });
        break;
      case "border-top":
        applyBorderShorthand(value, (width) => {
          target.borderTop = width;
        }, (color) => {
          target.borderColor = color ?? target.borderColor;
        });
        break;
      case "border-right":
        applyBorderShorthand(value, (width) => {
          target.borderRight = width;
        }, (color) => {
          target.borderColor = color ?? target.borderColor;
        });
        break;
      case "border-bottom":
        applyBorderShorthand(value, (width) => {
          target.borderBottom = width;
        }, (color) => {
          target.borderColor = color ?? target.borderColor;
        });
        break;
      case "border-left":
        applyBorderShorthand(value, (width) => {
          target.borderLeft = width;
        }, (color) => {
          target.borderColor = color ?? target.borderColor;
        });
        break;
      case "border-radius": {
        const parsed = parseBorderRadiusShorthand(value);
        if (parsed) {
          target.borderTopLeftRadiusX = parsed.topLeft.x;
          target.borderTopLeftRadiusY = parsed.topLeft.y;
          target.borderTopRightRadiusX = parsed.topRight.x;
          target.borderTopRightRadiusY = parsed.topRight.y;
          target.borderBottomRightRadiusX = parsed.bottomRight.x;
          target.borderBottomRightRadiusY = parsed.bottomRight.y;
          target.borderBottomLeftRadiusX = parsed.bottomLeft.x;
          target.borderBottomLeftRadiusY = parsed.bottomLeft.y;
        }
        break;
      }
      case "border-top-left-radius": {
        const parsed = parseBorderCornerRadius(value);
        if (parsed) {
          target.borderTopLeftRadiusX = parsed.x;
          target.borderTopLeftRadiusY = parsed.y;
        }
        break;
      }
      case "border-top-right-radius": {
        const parsed = parseBorderCornerRadius(value);
        if (parsed) {
          target.borderTopRightRadiusX = parsed.x;
          target.borderTopRightRadiusY = parsed.y;
        }
        break;
      }
      case "border-bottom-right-radius": {
        const parsed = parseBorderCornerRadius(value);
        if (parsed) {
          target.borderBottomRightRadiusX = parsed.x;
          target.borderBottomRightRadiusY = parsed.y;
        }
        break;
      }
      case "border-bottom-left-radius": {
        const parsed = parseBorderCornerRadius(value);
        if (parsed) {
          target.borderBottomLeftRadiusX = parsed.x;
          target.borderBottomLeftRadiusY = parsed.y;
        }
        break;
      }
      case "border-width":
        applyBoxShorthand(value, (top, right, bottom, left) => {
          target.borderTop = top;
          target.borderRight = right;
          target.borderBottom = bottom;
          target.borderLeft = left;
        }, parseBorderWidth);
        break;
      case "border-top-width":
        target.borderTop = parseBorderWidth(value) ?? target.borderTop;
        break;
      case "border-right-width":
        target.borderRight = parseBorderWidth(value) ?? target.borderRight;
        break;
      case "border-bottom-width":
        target.borderBottom = parseBorderWidth(value) ?? target.borderBottom;
        break;
      case "border-left-width":
        target.borderLeft = parseBorderWidth(value) ?? target.borderLeft;
        break;
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
        if (value.trim()) {
          target.borderColor = value.trim();
        }
        break;
      case "border-style":
        applyBorderStyleShorthand(value, (style) => {
          if (style === "none" || style === "hidden") {
            target.borderTop = 0;
            target.borderRight = 0;
            target.borderBottom = 0;
            target.borderLeft = 0;
          }
        });
        break;
      case "border-top-style":
        if (isNoneBorderStyle(value)) {
          target.borderTop = 0;
        }
        break;
      case "border-right-style":
        if (isNoneBorderStyle(value)) {
          target.borderRight = 0;
        }
        break;
      case "border-bottom-style":
        if (isNoneBorderStyle(value)) {
          target.borderBottom = 0;
        }
        break;
      case "border-left-style":
        if (isNoneBorderStyle(value)) {
          target.borderLeft = 0;
        }
        break;
      case "border-collapse": {
        const keyword = value.trim().toLowerCase();
        target.borderModel = keyword === "collapse" ? BorderModel.Collapse : BorderModel.Separate;
        break;
      }
      case "margin":
        applyBoxShorthand(value, (top, right, bottom, left) => {
          target.marginTop = top;
          target.marginRight = right;
          target.marginBottom = bottom;
          target.marginLeft = left;
        });
        break;
      case "margin-top":
        target.marginTop = parseLength(value) ?? target.marginTop;
        break;
      case "margin-right":
        target.marginRight = parseLength(value) ?? target.marginRight;
        break;
      case "margin-bottom":
        target.marginBottom = parseLength(value) ?? target.marginBottom;
        break;
      case "margin-left":
        target.marginLeft = parseLength(value) ?? target.marginLeft;
        break;
      case "padding":
        applyBoxShorthand(value, (top, right, bottom, left) => {
          target.paddingTop = top;
          target.paddingRight = right;
          target.paddingBottom = bottom;
          target.paddingLeft = left;
        });
        break;
      case "padding-top":
        target.paddingTop = parseLength(value) ?? target.paddingTop;
        break;
      case "padding-right":
        target.paddingRight = parseLength(value) ?? target.paddingRight;
        break;
      case "padding-bottom":
        target.paddingBottom = parseLength(value) ?? target.paddingBottom;
        break;
      case "padding-left":
        target.paddingLeft = parseLength(value) ?? target.paddingLeft;
        break;
      case "width":
        target.width = parseLength(value) ?? target.width;
        break;
      case "min-width":
        target.minWidth = parseLength(value) ?? target.minWidth;
        break;
      case "max-width":
        target.maxWidth = parseLength(value) ?? target.maxWidth;
        break;
      case "height":
        target.height = parseLength(value) ?? target.height;
        break;
      case "min-height":
        target.minHeight = parseLength(value) ?? target.minHeight;
        break;
      case "max-height":
        target.maxHeight = parseLength(value) ?? target.maxHeight;
        break;
      case "font-size":
        target.fontSize = parseNumeric(value) ?? target.fontSize;
        break;
      case "line-height":
        target.lineHeight = parseLineHeight(value);
        break;
      case "font-family":
        target.fontFamily = value;
        break;
      case "font-weight": {
        const parsed = parseFontWeightValue(value, inheritedFontWeight);
        if (parsed !== undefined) {
          target.fontWeight = parsed;
        }
        break;
      }
      case "text-align":
        target.textAlign = value.toLowerCase();
        break;
      case "text-decoration":
      case "text-decoration-line": {
        const parsed = parseTextDecorationLine(value);
        if (parsed !== undefined) {
          target.textDecorationLine = parsed;
        }
        break;
      }
      case "float":
        target.float = value;
        break;
      case "object-fit": {
        const normalized = value.trim().toLowerCase();
        if (["contain", "cover", "fill", "none", "scale-down"].includes(normalized)) {
          target.objectFit = normalized;
        }
        break;
      }
      case "background-size":
        target.backgroundSize = value.trim();
        break;
      case "background-image": {
        const gradient = parseLinearGradient(value);
        if (gradient) {
          if (!target.backgroundLayers) {
            target.backgroundLayers = [];
          }
          target.backgroundLayers.push({ kind: "gradient", gradient });
        }
        break;
      }
      case "background": {
        const trimmed = value.trim();
        // minimal & safe:
        // - gradient? route to the gradient path
        // - else treat as a color token
        if (trimmed.toLowerCase().startsWith("linear-gradient(")) {
          const gradient = parseLinearGradient(trimmed);
          if (gradient) {
            if (!target.backgroundLayers) {
              target.backgroundLayers = [];
            }
            target.backgroundLayers.push({ kind: "gradient", gradient });
          }
        } else if (trimmed.length > 0) {
          if (!target.backgroundLayers) {
            target.backgroundLayers = [];
          }
          target.backgroundLayers.push({ kind: "color", color: trimmed });
        }
        break;
      }
      default:
        break;
    }
  }
}
