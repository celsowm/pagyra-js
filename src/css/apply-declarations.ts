// src/css/apply-declarations.ts

import {
  AlignContent,
  AlignItems,
  BorderModel,
  Display,
  JustifyContent,
  type FlexDirection,
  type AlignSelfValue,
} from "./enums.js";
import { type BoxShadow } from "./style.js";
import { ptToPx, type UnitParsers } from "../units/units.js";
import { parseFontWeightValue } from "./font-weight.js";

// Global viewport state for unit parsing (consider refactoring this to be passed explicitly)
let CURRENT_VIEWPORT_WIDTH_PX = 0;
let CURRENT_VIEWPORT_HEIGHT_PX = 0;

export function setViewportSize(width: number, height: number): void {
  CURRENT_VIEWPORT_WIDTH_PX = Number.isFinite(width) && width > 0 ? width : 0;
  CURRENT_VIEWPORT_HEIGHT_PX = Number.isFinite(height) && height > 0 ? height : 0;
}

// Move the StyleAccumulator interface here
export interface StyleAccumulator {
  display?: Display;
  float?: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  boxShadows?: BoxShadow[];
  borderTop?: number;
  borderRight?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderTopLeftRadiusX?: number;
  borderTopLeftRadiusY?: number;
  borderTopRightRadiusX?: number;
  borderTopRightRadiusY?: number;
  borderBottomRightRadiusX?: number;
  borderBottomRightRadiusY?: number;
  borderBottomLeftRadiusX?: number;
  borderBottomLeftRadiusY?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  width?: number;
  minWidth?: number;
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
  fontWeight?: number;
  borderModel?: BorderModel;
  maxWidth?: number;
  textAlign?: string;
  objectFit?: string;
  backgroundSize?: string;
  textDecorationLine?: string;
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;
  alignContent?: AlignContent;
  alignSelf?: AlignSelfValue;
  flexDirection?: FlexDirection;
  flexWrap?: boolean;
}

function parseLength(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "auto") {
    return undefined;
  }
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(px|pt|vh|vw)?$/);
  if (!match) {
    return undefined;
  }
  const numeric = Number.parseFloat(match[1]);
  if (Number.isNaN(numeric)) {
    return undefined;
  }
  const unit = match[2] ?? "px";
  switch (unit) {
    case "px":
      return numeric;
    case "pt":
      return ptToPx(numeric);
    case "vh":
      return (numeric / 100) * CURRENT_VIEWPORT_HEIGHT_PX;
    case "vw":
      return (numeric / 100) * CURRENT_VIEWPORT_WIDTH_PX;
    default:
      return undefined;
  }
}

function parseNumeric(value: string): number | undefined {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px|pt)?$/i);
  if (!match) {
    return undefined;
  }
  let n = Number.parseFloat(match[1]);
  if ((match[2] ?? '').toLowerCase() === 'pt') n = ptToPx(n);
  return n;
}

function parseLineHeight(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  if (value.endsWith("px")) {
    return Number.parseFloat(value);
  }
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return undefined;
  }
  return numeric;
}

function mapDisplay(value: string | undefined): Display | undefined {
  switch (value) {
    case "block":
      return Display.Block;
    case "inline":
      return Display.Inline;
    case "inline-block":
      return Display.InlineBlock;
    case "flex":
      return Display.Flex;
    case "grid":
      return Display.Grid;
    case "table":
      return Display.Table;
    case "table-row":
      return Display.TableRow;
    case "table-cell":
      return Display.TableCell;
    case "table-row-group":
      return Display.TableRowGroup;
    case "table-header-group":
      return Display.TableHeaderGroup;
    case "table-footer-group":
      return Display.TableFooterGroup;
    case "table-caption":
      return Display.TableCaption;
    case "none":
      return Display.None;
    default:
      return undefined;
  }
}

function mapJustifyContent(value: string | undefined): JustifyContent | undefined {
  if (!value) {
    return undefined;
  }
  switch (value.trim().toLowerCase()) {
    case "flex-start":
      return JustifyContent.FlexStart;
    case "flex-end":
      return JustifyContent.FlexEnd;
    case "center":
      return JustifyContent.Center;
    case "space-between":
      return JustifyContent.SpaceBetween;
    case "space-around":
      return JustifyContent.SpaceAround;
    case "space-evenly":
      return JustifyContent.SpaceEvenly;
    case "start":
      return JustifyContent.Start;
    case "end":
      return JustifyContent.End;
    case "left":
      return JustifyContent.Left;
    case "right":
      return JustifyContent.Right;
    default:
      return undefined;
  }
}

function mapAlignItemsValue(value: string | undefined): AlignItems | undefined {
  if (!value) {
    return undefined;
  }
  switch (value.trim().toLowerCase()) {
    case "flex-start":
      return AlignItems.FlexStart;
    case "flex-end":
      return AlignItems.FlexEnd;
    case "center":
      return AlignItems.Center;
    case "baseline":
      return AlignItems.Baseline;
    case "stretch":
      return AlignItems.Stretch;
    default:
      return undefined;
  }
}

function mapAlignContentValue(value: string | undefined): AlignContent | undefined {
  if (!value) {
    return undefined;
  }
  switch (value.trim().toLowerCase()) {
    case "flex-start":
      return AlignContent.FlexStart;
    case "flex-end":
      return AlignContent.FlexEnd;
    case "center":
      return AlignContent.Center;
    case "space-between":
      return AlignContent.SpaceBetween;
    case "space-around":
      return AlignContent.SpaceAround;
    case "space-evenly":
      return AlignContent.SpaceEvenly;
    case "stretch":
      return AlignContent.Stretch;
    default:
      return undefined;
  }
}

function mapAlignSelfValue(value: string | undefined): AlignSelfValue | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") {
    return "auto";
  }
  return mapAlignItemsValue(normalized);
}

function parseFlexDirectionValue(value: string | undefined): FlexDirection | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "row":
    case "row-reverse":
    case "column":
    case "column-reverse":
      return normalized as FlexDirection;
    default:
      return undefined;
  }
}

function applyBoxShorthand(
  value: string,
  apply: (top: number | undefined, right: number | undefined, bottom: number | undefined, left: number | undefined) => void,
  parser: (input: string) => number | undefined = parseLength,
): void {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return;
  }
  const resolved = parts.map((part) => parser(part));
  const [top, right, bottom, left] =
    resolved.length === 1
      ? [resolved[0], resolved[0], resolved[0], resolved[0]]
      : resolved.length === 2
        ? [resolved[0], resolved[1], resolved[0], resolved[1]]
        : resolved.length === 3
          ? [resolved[0], resolved[1], resolved[2], resolved[1]]
          : [resolved[0], resolved[1], resolved[2], resolved[3]];
  apply(top, right, bottom, left);
}

const BORDER_STYLE_KEYWORDS = new Set([
  "none",
  "hidden",
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

const BORDER_WIDTH_KEYWORD_MAP: Record<string, number> = {
  thin: 1,
  medium: 3,
  thick: 5,
};

const DEFAULT_BORDER_WIDTH = BORDER_WIDTH_KEYWORD_MAP.medium;

interface ParsedBorder {
  width?: number;
  style?: string;
  color?: string;
}

function applyBorderShorthand(
  value: string,
  applyWidth: (width: number) => void,
  applyColor: (color: string | undefined) => void,
): void {
  const parsed = parseBorderShorthand(value);
  if (!parsed) {
    return;
  }

  if (parsed.style === "none" || parsed.style === "hidden") {
    applyWidth(0);
  } else if (parsed.width !== undefined) {
    applyWidth(parsed.width);
  } else if (parsed.style) {
    applyWidth(DEFAULT_BORDER_WIDTH);
  }

  if (parsed.color !== undefined) {
    applyColor(parsed.color);
  }
}

function applyBorderColorShorthand(value: string, applyColor: (color: string) => void): void {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return;
  }
  const [top] =
    parts.length === 1
      ? [parts[0], parts[0], parts[0], parts[0]]
      : parts.length === 2
        ? [parts[0], parts[1], parts[0], parts[1]]
        : parts.length === 3
          ? [parts[0], parts[1], parts[2], parts[1]]
          : [parts[0], parts[1], parts[2], parts[3]];
  if (top) {
    applyColor(top);
  }
}

function applyBorderStyleShorthand(value: string, apply: (style: string | undefined) => void): void {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return;
  }
  apply(parts[0]?.toLowerCase());
}

function isNoneBorderStyle(value: string): boolean {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return false;
  }
  const keyword = parts[0]?.toLowerCase();
  return keyword === "none" || keyword === "hidden";
}

function parseBorderShorthand(value: string): ParsedBorder | null {
  const parts = splitCssList(value);
  if (parts.length === 0) {
    return null;
  }

  let width: number | undefined;
  let style: string | undefined;
  let color: string | undefined;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    if (width === undefined) {
      const maybeWidth = parseBorderWidth(trimmed);
      if (maybeWidth !== undefined) {
        width = maybeWidth;
        continue;
      }
    }

    const lower = trimmed.toLowerCase();
    if (!style && BORDER_STYLE_KEYWORDS.has(lower)) {
      style = lower;
      continue;
    }

    if (color === undefined) {
      color = trimmed;
    }
  }

  if (style === "none" || style === "hidden") {
    width = 0;
  } else if (width === undefined && style) {
    width = DEFAULT_BORDER_WIDTH;
  }

  return { width, style, color };
}

function parseBorderWidth(value: string): number | undefined {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed in BORDER_WIDTH_KEYWORD_MAP) {
    return BORDER_WIDTH_KEYWORD_MAP[trimmed];
  }
  return parseLength(value);
}

interface ParsedCornerRadiusPair {
  x: number;
  y: number;
}

interface ParsedBorderRadius {
  topLeft: ParsedCornerRadiusPair;
  topRight: ParsedCornerRadiusPair;
  bottomRight: ParsedCornerRadiusPair;
  bottomLeft: ParsedCornerRadiusPair;
}

function parseBorderRadiusShorthand(value: string): ParsedBorderRadius | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const [horizontalPart, verticalPart] = trimmed.split("/").map((part) => part.trim());
  const horizontalValues = expandBorderRadiusList(horizontalPart);
  if (!horizontalValues) {
    return null;
  }
  const verticalValues = verticalPart ? expandBorderRadiusList(verticalPart) : horizontalValues;
  if (!verticalValues) {
    return null;
  }
  return {
    topLeft: { x: horizontalValues[0], y: verticalValues[0] },
    topRight: { x: horizontalValues[1], y: verticalValues[1] },
    bottomRight: { x: horizontalValues[2], y: verticalValues[2] },
    bottomLeft: { x: horizontalValues[3], y: verticalValues[3] },
  };
}

function parseBorderCornerRadius(value: string): ParsedCornerRadiusPair | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const [horizontalRaw, verticalRaw] = trimmed.split("/").map((part) => part.trim());
  const horizontalList = splitCssList(horizontalRaw);
  if (horizontalList.length === 0) {
    return undefined;
  }
  const horizontal = clampPositive(parseLength(horizontalList[0]));
  let vertical: number;
  if (verticalRaw) {
    const verticalList = splitCssList(verticalRaw);
    vertical = clampPositive(parseLength(verticalList[0]));
  } else if (horizontalList.length > 1) {
    vertical = clampPositive(parseLength(horizontalList[1]));
  } else {
    vertical = horizontal;
  }
  return { x: horizontal, y: vertical };
}

function expandBorderRadiusList(input: string | undefined): [number, number, number, number] | null {
  if (!input) {
    return null;
  }
  const parts = splitCssList(input);
  if (parts.length === 0) {
    return null;
  }
  const resolved = parts.map((part) => clampPositive(parseLength(part)));
  switch (resolved.length) {
    case 1:
      return [resolved[0], resolved[0], resolved[0], resolved[0]];
    case 2:
      return [resolved[0], resolved[1], resolved[0], resolved[1]];
    case 3:
      return [resolved[0], resolved[1], resolved[2], resolved[1]];
    default:
      return [resolved[0], resolved[1], resolved[2], resolved[3]];
  }
}

function clampPositive(value: number | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 0;
  }
  const numeric = Number(value);
  return numeric > 0 ? numeric : 0;
}

function parseBoxShadowList(value: string): BoxShadow[] | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const keyword = trimmed.toLowerCase();
  if (keyword === "none" || keyword === "initial") {
    return [];
  }
  if (keyword === "inherit" || keyword === "revert" || keyword === "revert-layer") {
    return undefined;
  }
  const layers = splitCssCommaList(trimmed);
  const result: BoxShadow[] = [];
  for (const layer of layers) {
    const parsed = parseSingleBoxShadow(layer);
    if (parsed) {
      result.push(parsed);
    }
  }
  return result;
}

function parseSingleBoxShadow(input: string): BoxShadow | null {
  const tokens = splitCssList(input);
  if (tokens.length === 0) {
    return null;
  }
  let inset = false;
  const lengths: number[] = [];
  let color: string | undefined;

  for (const token of tokens) {
    const lowered = token.toLowerCase();
    if (lowered === "inset") {
      inset = true;
      continue;
    }
    const length = parseLength(token);
    if (length !== undefined) {
      lengths.push(length);
      continue;
    }
    if (color === undefined) {
      color = token;
      continue;
    }
    return null;
  }

  if (lengths.length < 2) {
    return null;
  }

  const offsetX = lengths[0];
  const offsetY = lengths[1];
  const blurRadius = clampNonNegative(lengths[2] ?? 0);
  const spreadRadius = lengths[3] ?? 0;

  return {
    inset,
    offsetX,
    offsetY,
    blurRadius,
    spreadRadius,
    color,
  };
}

function splitCssCommaList(value: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;

  for (const char of value) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      if (current.trim()) {
        result.push(current.trim());
      }
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value < 0 ? 0 : value;
}

function splitCssList(value: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;

  for (const char of value) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (/\s/.test(char) && depth === 0) {
      if (current.trim()) {
        result.push(current.trim());
      }
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

function parseTextDecorationLine(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const tokens = value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) {
    return undefined;
  }
  if (tokens.includes("none")) {
    return "none";
  }
  const allowed = new Set(["underline", "overline", "line-through"]);
  const matches = tokens.filter((token) => allowed.has(token));
  if (matches.length === 0) {
    return undefined;
  }
  const unique = [...new Set(matches)];
  return unique.join(" ");
}

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
        target.backgroundColor = value;
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
      default:
        break;
    }
  }
}
