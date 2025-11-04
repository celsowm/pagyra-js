// src/css/parsers/register-parsers.ts

import { registerPropertyParser } from "./registry.js";

// Display and Flex
import {
  parseDisplay,
  parseJustifyContent,
  parseAlignItems,
  parseAlignContent,
  parseAlignSelf,
  parseFlexDirection,
  parseFlexWrap,
} from "./display-flex-parser.js";

// Color
import { parseColor, parseBackgroundColor } from "./color-parser.js";

// Border
import {
  parseBorderColor,
  parseBoxShadow,
  parseBorder,
  parseBorderTop,
  parseBorderRight,
  parseBorderBottom,
  parseBorderLeft,
  parseBorderRadius,
  parseBorderTopLeftRadius,
  parseBorderTopRightRadius,
  parseBorderBottomRightRadius,
  parseBorderBottomLeftRadius,
  parseBorderWidth,
  parseBorderTopWidth,
  parseBorderRightWidth,
  parseBorderBottomWidth,
  parseBorderLeftWidth,
  parseBorderTopColor,
  parseBorderRightColor,
  parseBorderBottomColor,
  parseBorderLeftColor,
  parseBorderStyle,
  parseBorderTopStyle,
  parseBorderRightStyle,
  parseBorderBottomStyle,
  parseBorderLeftStyle,
  parseBorderCollapse,
} from "./border-parser-extended.js";

// Margin
import {
  parseMargin,
  parseMarginTop,
  parseMarginRight,
  parseMarginBottom,
  parseMarginLeft,
} from "./margin-parser.js";

// Padding
import {
  parsePadding,
  parsePaddingTop,
  parsePaddingRight,
  parsePaddingBottom,
  parsePaddingLeft,
} from "./padding-parser.js";

// Dimensions
import {
  parseWidth,
  parseMinWidth,
  parseMaxWidth,
  parseHeight,
  parseMinHeight,
  parseMaxHeight,
  parseFontSize,
  parseLineHeight,
  parseZIndex,
} from "./dimension-parser.js";

// Font
import { parseFontFamily, parseFontStyle, parseFontWeight } from "./font-parser.js";

// Positioning
import { parsePosition, parseTop, parseRight, parseBottom, parseLeft } from "./position-parser.js";

// Text
import {
  parseTextAlign,
  parseTextDecoration,
  parseTextDecorationLine,
  parseFloat,
} from "./text-parser-extended.js";

// Background
import {
  applyBackgroundSizeDecl,
  parseBackgroundImage,
  parseBackground,
  parseObjectFit,
} from "./background-parser-extended.js";

// Grid
import {
  parseGridTemplateColumns,
  parseGridTemplateRows,
  parseGridAutoFlow,
  parseGap,
  parseRowGap,
  parseColumnGap,
} from "./grid-parser-extended.js";

// Flag to ensure parsers are registered only once
let parsersRegistered = false;

export function registerAllPropertyParsers(): void {
  // Idempotency guard
  if (parsersRegistered) {
    return;
  }
  parsersRegistered = true;

  // Display and Flex
  registerPropertyParser("display", parseDisplay);
  registerPropertyParser("justify-content", parseJustifyContent);
  registerPropertyParser("align-items", parseAlignItems);
  registerPropertyParser("align-content", parseAlignContent);
  registerPropertyParser("align-self", parseAlignSelf);
  registerPropertyParser("flex-direction", parseFlexDirection);
  registerPropertyParser("flex-wrap", parseFlexWrap);

  // Color
  registerPropertyParser("color", parseColor);
  registerPropertyParser("background-color", parseBackgroundColor);

  // Border
  registerPropertyParser("border-color", parseBorderColor);
  registerPropertyParser("box-shadow", parseBoxShadow);
  registerPropertyParser("border", parseBorder);
  registerPropertyParser("border-top", parseBorderTop);
  registerPropertyParser("border-right", parseBorderRight);
  registerPropertyParser("border-bottom", parseBorderBottom);
  registerPropertyParser("border-left", parseBorderLeft);
  registerPropertyParser("border-radius", parseBorderRadius);
  registerPropertyParser("border-top-left-radius", parseBorderTopLeftRadius);
  registerPropertyParser("border-top-right-radius", parseBorderTopRightRadius);
  registerPropertyParser("border-bottom-right-radius", parseBorderBottomRightRadius);
  registerPropertyParser("border-bottom-left-radius", parseBorderBottomLeftRadius);
  registerPropertyParser("border-width", parseBorderWidth);
  registerPropertyParser("border-top-width", parseBorderTopWidth);
  registerPropertyParser("border-right-width", parseBorderRightWidth);
  registerPropertyParser("border-bottom-width", parseBorderBottomWidth);
  registerPropertyParser("border-left-width", parseBorderLeftWidth);
  registerPropertyParser("border-top-color", parseBorderTopColor);
  registerPropertyParser("border-right-color", parseBorderRightColor);
  registerPropertyParser("border-bottom-color", parseBorderBottomColor);
  registerPropertyParser("border-left-color", parseBorderLeftColor);
  registerPropertyParser("border-style", parseBorderStyle);
  registerPropertyParser("border-top-style", parseBorderTopStyle);
  registerPropertyParser("border-right-style", parseBorderRightStyle);
  registerPropertyParser("border-bottom-style", parseBorderBottomStyle);
  registerPropertyParser("border-left-style", parseBorderLeftStyle);
  registerPropertyParser("border-collapse", parseBorderCollapse);

  // Margin
  registerPropertyParser("margin", parseMargin);
  registerPropertyParser("margin-top", parseMarginTop);
  registerPropertyParser("margin-right", parseMarginRight);
  registerPropertyParser("margin-bottom", parseMarginBottom);
  registerPropertyParser("margin-left", parseMarginLeft);

  // Padding
  registerPropertyParser("padding", parsePadding);
  registerPropertyParser("padding-top", parsePaddingTop);
  registerPropertyParser("padding-right", parsePaddingRight);
  registerPropertyParser("padding-bottom", parsePaddingBottom);
  registerPropertyParser("padding-left", parsePaddingLeft);

  // Dimensions
  registerPropertyParser("width", parseWidth);
  registerPropertyParser("min-width", parseMinWidth);
  registerPropertyParser("max-width", parseMaxWidth);
  registerPropertyParser("height", parseHeight);
  registerPropertyParser("min-height", parseMinHeight);
  registerPropertyParser("max-height", parseMaxHeight);
  registerPropertyParser("font-size", parseFontSize);
  registerPropertyParser("line-height", parseLineHeight);
  registerPropertyParser("z-index", parseZIndex);

  // Font
  registerPropertyParser("font-family", parseFontFamily);
  registerPropertyParser("font-style", parseFontStyle);
  registerPropertyParser("font-weight", parseFontWeight);

  // Positioning
  registerPropertyParser("position", parsePosition);
  registerPropertyParser("top", parseTop);
  registerPropertyParser("right", parseRight);
  registerPropertyParser("bottom", parseBottom);
  registerPropertyParser("left", parseLeft);

  // Text
  registerPropertyParser("text-align", parseTextAlign);
  registerPropertyParser("text-decoration", parseTextDecoration);
  registerPropertyParser("text-decoration-line", parseTextDecorationLine);
  registerPropertyParser("float", parseFloat);

  // Background
  registerPropertyParser("background-size", applyBackgroundSizeDecl);
  registerPropertyParser("background-image", parseBackgroundImage);
  registerPropertyParser("background", parseBackground);
  registerPropertyParser("object-fit", parseObjectFit);

  // Grid
  registerPropertyParser("grid-template-columns", parseGridTemplateColumns);
  registerPropertyParser("grid-template-rows", parseGridTemplateRows);
  registerPropertyParser("grid-auto-flow", parseGridAutoFlow);
  registerPropertyParser("gap", parseGap);
  registerPropertyParser("row-gap", parseRowGap);
  registerPropertyParser("column-gap", parseColumnGap);
}
