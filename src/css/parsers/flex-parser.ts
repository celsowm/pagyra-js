// src/css/parsers/flex-parser.ts

import {
  AlignContent,
  AlignItems,
  Display,
  JustifyContent,
  type FlexDirection,
  type AlignSelfValue,
} from "../enums.js";

export function mapDisplay(value: string | undefined): Display | undefined {
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

export function mapJustifyContent(value: string | undefined): JustifyContent | undefined {
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

export function mapAlignItemsValue(value: string | undefined): AlignItems | undefined {
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

export function mapAlignContentValue(value: string | undefined): AlignContent | undefined {
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

export function mapAlignSelfValue(value: string | undefined): AlignSelfValue | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") {
    return "auto";
  }
  return mapAlignItemsValue(normalized);
}

export function parseFlexDirectionValue(value: string | undefined): FlexDirection | undefined {
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
