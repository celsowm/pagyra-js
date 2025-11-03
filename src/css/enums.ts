export enum Display {
  Block = "block",
  Inline = "inline",
  InlineBlock = "inline-block",
  Flex = "flex",
  InlineFlex = "inline-flex",
  Grid = "grid",
  InlineGrid = "inline-grid",
  Table = "table",
  InlineTable = "inline-table",
  TableRowGroup = "table-row-group",
  TableHeaderGroup = "table-header-group",
  TableFooterGroup = "table-footer-group",
  TableRow = "table-row",
  TableCell = "table-cell",
  TableCaption = "table-caption",
  ListItem = "list-item",
  None = "none",
  FlowRoot = "flow-root",
}

export enum Position {
  Static = "static",
  Relative = "relative",
  Absolute = "absolute",
  Fixed = "fixed",
  Sticky = "sticky",
}

export enum FloatMode {
  None = "none",
  Left = "left",
  Right = "right",
}

export enum ClearMode {
  None = "none",
  Left = "left",
  Right = "right",
  Both = "both",
  InlineStart = "inline-start",
  InlineEnd = "inline-end",
}

export enum OverflowMode {
  Visible = "visible",
  Hidden = "hidden",
  Scroll = "scroll",
  Auto = "auto",
  Clip = "clip",
}

export enum WhiteSpace {
  Normal = "normal",
  NoWrap = "nowrap",
  Pre = "pre",
  PreWrap = "pre-wrap",
  PreLine = "pre-line",
}

export enum TextWrap {
  Wrap = "wrap",
  NoWrap = "nowrap",
  Balance = "balance",
}

export enum AlignItems {
  Stretch = "stretch",
  FlexStart = "flex-start",
  FlexEnd = "flex-end",
  Center = "center",
  Baseline = "baseline",
}

export enum JustifyContent {
  FlexStart = "flex-start",
  FlexEnd = "flex-end",
  Center = "center",
  SpaceBetween = "space-between",
  SpaceAround = "space-around",
  SpaceEvenly = "space-evenly",
  Start = "start",
  End = "end",
  Left = "left",
  Right = "right",
}

export enum AlignContent {
  Stretch = "stretch",
  FlexStart = "flex-start",
  FlexEnd = "flex-end",
  Center = "center",
  SpaceBetween = "space-between",
  SpaceAround = "space-around",
  SpaceEvenly = "space-evenly",
}

export enum VerticalAlign {
  Baseline = "baseline",
  Top = "top",
  Middle = "middle",
  Bottom = "bottom",
  TextTop = "text-top",
  TextBottom = "text-bottom",
  Sub = "sub",
  Super = "super",
}

export enum WritingMode {
  HorizontalTb = "horizontal-tb",
  VerticalRl = "vertical-rl",
  VerticalLr = "vertical-lr",
}

export enum TableLayoutMode {
  Auto = "auto",
  Fixed = "fixed",
}

export enum BorderModel {
  Separate = "separate",
  Collapse = "collapse",
}

export type FlexDirection = "row" | "row-reverse" | "column" | "column-reverse";

export type AlignSelfValue = "auto" | AlignItems;
