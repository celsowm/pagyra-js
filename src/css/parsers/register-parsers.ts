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
  parseFlexGrow,
  parseFlexShrink,
  parseFlexBasis,
  parseFlex,
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

import {
  parseBorderBlockStart,
  parseBorderBlockEnd,
} from "./border-block-parser.js";

import {
  parseBorderInlineStart,
  parseBorderInlineEnd,
} from "./border-inline-parser.js";

// Margin
import {
  parseMargin,
  parseMarginTop,
  parseMarginRight,
  parseMarginBottom,
  parseMarginLeft,
} from "./margin-parser.js";

import {
  parseMarginBlockStart,
  parseMarginBlockEnd,
} from "./margin-block-parser.js";

import {
  parseMarginInlineStart,
  parseMarginInlineEnd,
} from "./margin-inline-parser.js";

// Padding
import {
  parsePadding,
  parsePaddingTop,
  parsePaddingRight,
  parsePaddingBottom,
  parsePaddingLeft,
} from "./padding-parser.js";

import {
  parsePaddingBlockStart,
  parsePaddingBlockEnd,
} from "./padding-block-parser.js";

import {
  parsePaddingInlineStart,
  parsePaddingInlineEnd,
} from "./padding-inline-parser.js";

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
import { parseFontFamily, parseFontStyle, parseFontVariant, parseFontWeight, parseFontVariantNumeric } from "./font-parser.js";

// Positioning
import { parsePosition, parseTop, parseRight, parseBottom, parseLeft } from "./position-parser.js";

// Text
import {
  parseTextAlign,
  parseTextDecoration,
  parseTextDecorationLine,
  parseTextDecorationColor,
  parseTextDecorationStyle,
  parseFloat,
  parseTextIndent,
  parseTextTransform,
  parseLetterSpacing,
} from "./text-parser-extended.js";
import { parseOverflowWrap, parseWordWrap } from "./overflow-wrap-parser.js";
import { parseWordBreak } from "./word-break-parser.js";
import { parseTextShadow } from "./text-shadow-parser.js";
import { parseListStyleType } from "./list-style-parser.js";
import { parseContent } from "./content-parser.js";
import { parseCounterIncrement, parseCounterReset } from "../../layout/counter.js";

// Background
import {
  applyBackgroundSizeDecl,
  applyBackgroundPositionDecl,
  applyBackgroundOriginDecl,
  applyBackgroundRepeatDecl,
  applyBackgroundClipDecl,
  parseBackgroundImage,
  parseBackground,
  parseObjectFit,
} from "./background-parser-extended.js";
import { parseClipPath } from "./clip-path-parser.js";

// Grid
import {
  parseGridTemplateColumns,
  parseGridTemplateRows,
  parseGridAutoFlow,
  parseGridColumn,
  parseGap,
  parseRowGap,
  parseColumnGap,
} from "./grid-parser-extended.js";

// Opacity
import { parseOpacity } from "./opacity-parser.js";

// Filter
import { parseFilter, parseBackdropFilter } from "./filter-parser.js";

// Flag to ensure parsers are registered only once
let parsersRegistered = false;

export function registerAllPropertyParsers(): void {
  // Idempotency guard
  if (parsersRegistered) {
    return;
  }
  parsersRegistered = true;

  // Box Sizing
  registerPropertyParser("box-sizing", (value: string, target) => {
    const lower = value.trim().toLowerCase();
    if (lower === "border-box" || lower === "content-box") {
      target.boxSizing = lower;
    }
  });

  // Display and Flex
  registerPropertyParser("display", parseDisplay);
  registerPropertyParser("justify-content", parseJustifyContent);
  registerPropertyParser("align-items", parseAlignItems);
  registerPropertyParser("align-content", parseAlignContent);
  registerPropertyParser("align-self", parseAlignSelf);
  registerPropertyParser("flex-direction", parseFlexDirection);
  registerPropertyParser("flex-wrap", parseFlexWrap);
  registerPropertyParser("flex-grow", parseFlexGrow);
  registerPropertyParser("flex-shrink", parseFlexShrink);
  registerPropertyParser("flex-basis", parseFlexBasis);
  registerPropertyParser("flex", parseFlex);

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
  registerPropertyParser("border-block-start", parseBorderBlockStart);
  registerPropertyParser("border-block-end", parseBorderBlockEnd);
  registerPropertyParser("border-inline-start", parseBorderInlineStart);
  registerPropertyParser("border-inline-end", parseBorderInlineEnd);

  // Margin
  registerPropertyParser("margin", parseMargin);
  registerPropertyParser("margin-top", parseMarginTop);
  registerPropertyParser("margin-right", parseMarginRight);
  registerPropertyParser("margin-bottom", parseMarginBottom);
  registerPropertyParser("margin-left", parseMarginLeft);
  registerPropertyParser("margin-block-start", parseMarginBlockStart);
  registerPropertyParser("margin-block-end", parseMarginBlockEnd);
  registerPropertyParser("margin-inline-start", parseMarginInlineStart);
  registerPropertyParser("margin-inline-end", parseMarginInlineEnd);

  // Padding
  registerPropertyParser("padding", parsePadding);
  registerPropertyParser("padding-top", parsePaddingTop);
  registerPropertyParser("padding-right", parsePaddingRight);
  registerPropertyParser("padding-bottom", parsePaddingBottom);
  registerPropertyParser("padding-left", parsePaddingLeft);
  registerPropertyParser("padding-block-start", parsePaddingBlockStart);
  registerPropertyParser("padding-block-end", parsePaddingBlockEnd);
  registerPropertyParser("padding-inline-start", parsePaddingInlineStart);
  registerPropertyParser("padding-inline-end", parsePaddingInlineEnd);

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
  registerPropertyParser("font-variant", parseFontVariant);
  registerPropertyParser("font-variant-numeric", parseFontVariantNumeric);
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
  registerPropertyParser("text-decoration-color", parseTextDecorationColor);
  registerPropertyParser("text-decoration-style", parseTextDecorationStyle);
  registerPropertyParser("letter-spacing", parseLetterSpacing);
  registerPropertyParser("text-indent", parseTextIndent);
  registerPropertyParser("text-transform", parseTextTransform);
  registerPropertyParser("float", parseFloat);
  registerPropertyParser("overflow-wrap", parseOverflowWrap);
  registerPropertyParser("word-wrap", parseWordWrap);
  registerPropertyParser("word-break", parseWordBreak);
  registerPropertyParser("text-shadow", parseTextShadow);
  registerPropertyParser("list-style-type", parseListStyleType);
  registerPropertyParser("content", parseContent);
  registerPropertyParser("counter-reset", (value, target) => {
    target.counterReset = parseCounterReset(value);
  });
  registerPropertyParser("counter-increment", (value, target) => {
    target.counterIncrement = parseCounterIncrement(value);
  });
  // Transform (store as raw string for limited later use)
  registerPropertyParser("transform", (value, target) => {
    // store raw transform string
    target.transform = value;
  });

  // Background
  registerPropertyParser("background-size", applyBackgroundSizeDecl);
  registerPropertyParser("background-position", applyBackgroundPositionDecl);
  registerPropertyParser("background-origin", applyBackgroundOriginDecl);
  registerPropertyParser("background-repeat", applyBackgroundRepeatDecl);
  registerPropertyParser("background-clip", applyBackgroundClipDecl);
  registerPropertyParser("background-image", parseBackgroundImage);
  registerPropertyParser("background", parseBackground);
  registerPropertyParser("object-fit", parseObjectFit);
  registerPropertyParser("clip-path", parseClipPath);

  // Grid
  registerPropertyParser("grid-template-columns", parseGridTemplateColumns);
  registerPropertyParser("grid-template-rows", parseGridTemplateRows);
  registerPropertyParser("grid-auto-flow", parseGridAutoFlow);
  registerPropertyParser("grid-column", parseGridColumn);
  registerPropertyParser("gap", parseGap);
  registerPropertyParser("row-gap", parseRowGap);
  registerPropertyParser("column-gap", parseColumnGap);

  // Opacity
  registerPropertyParser("opacity", parseOpacity);

  // Filter
  registerPropertyParser("filter", parseFilter);
  registerPropertyParser("backdrop-filter", parseBackdropFilter);
  registerPropertyParser("-webkit-backdrop-filter", parseBackdropFilter); // vendor prefix comum
}
