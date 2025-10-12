import {
  AlignContent,
  AlignItems,
  BorderModel,
  ClearMode,
  Display,
  FloatMode,
  JustifyContent,
  OverflowMode,
  Position,
  TableLayoutMode,
  TextWrap,
  WhiteSpace,
  WritingMode,
} from "./enums.js";
import { AUTO_LENGTH } from "./length.js";
import type { CSSLength, LengthLike } from "./length.js";

export type FlexDirection = "row" | "row-reverse" | "column" | "column-reverse";
export type GridAutoFlow = "row" | "column" | "row dense" | "column dense";
export type AlignSelfValue = AlignItems | "auto";

export type TrackDefinition = string | CSSLength;

export interface StyleProperties {
  display: Display;
  position: Position;
  float: FloatMode;
  clear: ClearMode;
  overflowX: OverflowMode;
  overflowY: OverflowMode;
  whiteSpace: WhiteSpace;
  textWrap: TextWrap;
  writingMode: WritingMode;
  width: LengthLike;
  height: LengthLike;
  minWidth?: LengthLike;
  maxWidth?: LengthLike;
  minHeight?: LengthLike;
  maxHeight?: LengthLike;
  marginTop: LengthLike;
  marginRight: LengthLike;
  marginBottom: LengthLike;
  marginLeft: LengthLike;
  paddingTop: LengthLike;
  paddingRight: LengthLike;
  paddingBottom: LengthLike;
  paddingLeft: LengthLike;
  borderTop: LengthLike;
  borderRight: LengthLike;
  borderBottom: LengthLike;
  borderLeft: LengthLike;
  left?: LengthLike;
  right?: LengthLike;
  top?: LengthLike;
  bottom?: LengthLike;
  insetInlineStart?: LengthLike;
  insetInlineEnd?: LengthLike;
  insetBlockStart?: LengthLike;
  insetBlockEnd?: LengthLike;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  flexGrow: number;
  flexShrink: number;
  flexBasis: LengthLike;
  alignItems: AlignItems;
  alignSelf: AlignSelfValue;
  justifyContent: JustifyContent;
  alignContent: AlignContent;
  flexDirection: FlexDirection;
  flexWrap: boolean;
  trackListColumns: TrackDefinition[];
  trackListRows: TrackDefinition[];
  autoFlow: GridAutoFlow;
  tableLayout: TableLayoutMode;
  borderModel: BorderModel;
  breakBefore: string;
  breakAfter: string;
  breakInside: string;
  widows: number;
  orphans: number;
}

const defaultStyle = {
  display: Display.Block,
  position: Position.Static,
  float: FloatMode.None,
  clear: ClearMode.None,
  overflowX: OverflowMode.Visible,
  overflowY: OverflowMode.Visible,
  whiteSpace: WhiteSpace.Normal,
  textWrap: TextWrap.Wrap,
  writingMode: WritingMode.HorizontalTb,
  width: "auto",
  height: "auto",
  minWidth: undefined,
  maxWidth: undefined,
  minHeight: undefined,
  maxHeight: undefined,
  marginTop: 0,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  borderTop: 0,
  borderRight: 0,
  borderBottom: 0,
  borderLeft: 0,
  left: undefined,
  right: undefined,
  top: undefined,
  bottom: undefined,
  insetInlineStart: undefined,
  insetInlineEnd: undefined,
  insetBlockStart: undefined,
  insetBlockEnd: undefined,
  fontSize: 16,
  lineHeight: 1.2,
  letterSpacing: 0,
  wordSpacing: 0,
  flexGrow: 0,
  flexShrink: 1,
  flexBasis: AUTO_LENGTH,
  alignItems: AlignItems.Stretch,
  alignSelf: "auto",
  justifyContent: JustifyContent.FlexStart,
  alignContent: AlignContent.Stretch,
  flexDirection: "row",
  flexWrap: false,
  trackListColumns: [],
  trackListRows: [],
  autoFlow: "row",
  tableLayout: TableLayoutMode.Auto,
  borderModel: BorderModel.Separate,
  breakBefore: "auto",
  breakAfter: "auto",
  breakInside: "auto",
  widows: 2,
  orphans: 2,
} satisfies StyleProperties;

export class ComputedStyle implements StyleProperties {
  display: Display;
  position: Position;
  float: FloatMode;
  clear: ClearMode;
  overflowX: OverflowMode;
  overflowY: OverflowMode;
  whiteSpace: WhiteSpace;
  textWrap: TextWrap;
  writingMode: WritingMode;
  width: LengthLike;
  height: LengthLike;
  minWidth?: LengthLike;
  maxWidth?: LengthLike;
  minHeight?: LengthLike;
  maxHeight?: LengthLike;
  marginTop: LengthLike;
  marginRight: LengthLike;
  marginBottom: LengthLike;
  marginLeft: LengthLike;
  paddingTop: LengthLike;
  paddingRight: LengthLike;
  paddingBottom: LengthLike;
  paddingLeft: LengthLike;
  borderTop: LengthLike;
  borderRight: LengthLike;
  borderBottom: LengthLike;
  borderLeft: LengthLike;
  left?: LengthLike;
  right?: LengthLike;
  top?: LengthLike;
  bottom?: LengthLike;
  insetInlineStart?: LengthLike;
  insetInlineEnd?: LengthLike;
  insetBlockStart?: LengthLike;
  insetBlockEnd?: LengthLike;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  flexGrow: number;
  flexShrink: number;
  flexBasis: LengthLike;
  alignItems: AlignItems;
  alignSelf: AlignSelfValue;
  justifyContent: JustifyContent;
  alignContent: AlignContent;
  flexDirection: FlexDirection;
  flexWrap: boolean;
  trackListColumns: TrackDefinition[];
  trackListRows: TrackDefinition[];
  autoFlow: GridAutoFlow;
  tableLayout: TableLayoutMode;
  borderModel: BorderModel;
  breakBefore: string;
  breakAfter: string;
  breakInside: string;
  widows: number;
  orphans: number;

  constructor(init?: Partial<StyleProperties>) {
    const data: StyleProperties = {
      ...defaultStyle,
      ...init,
      flexBasis: init?.flexBasis ?? defaultStyle.flexBasis,
      trackListColumns: [...(init?.trackListColumns ?? defaultStyle.trackListColumns)],
      trackListRows: [...(init?.trackListRows ?? defaultStyle.trackListRows)],
    };

    this.display = data.display;
    this.position = data.position;
    this.float = data.float;
    this.clear = data.clear;
    this.overflowX = data.overflowX;
    this.overflowY = data.overflowY;
    this.whiteSpace = data.whiteSpace;
    this.textWrap = data.textWrap;
    this.writingMode = data.writingMode;
    this.width = data.width;
    this.height = data.height;
    this.minWidth = data.minWidth;
    this.maxWidth = data.maxWidth;
    this.minHeight = data.minHeight;
    this.maxHeight = data.maxHeight;
    this.marginTop = data.marginTop;
    this.marginRight = data.marginRight;
    this.marginBottom = data.marginBottom;
    this.marginLeft = data.marginLeft;
    this.paddingTop = data.paddingTop;
    this.paddingRight = data.paddingRight;
    this.paddingBottom = data.paddingBottom;
    this.paddingLeft = data.paddingLeft;
    this.borderTop = data.borderTop;
    this.borderRight = data.borderRight;
    this.borderBottom = data.borderBottom;
    this.borderLeft = data.borderLeft;
    this.left = data.left;
    this.right = data.right;
    this.top = data.top;
    this.bottom = data.bottom;
    this.insetInlineStart = data.insetInlineStart;
    this.insetInlineEnd = data.insetInlineEnd;
    this.insetBlockStart = data.insetBlockStart;
    this.insetBlockEnd = data.insetBlockEnd;
    this.fontSize = data.fontSize;
    this.lineHeight = data.lineHeight;
    this.letterSpacing = data.letterSpacing;
    this.wordSpacing = data.wordSpacing;
    this.flexGrow = data.flexGrow;
    this.flexShrink = data.flexShrink;
    this.flexBasis = data.flexBasis;
    this.alignItems = data.alignItems;
    this.alignSelf = data.alignSelf;
    this.justifyContent = data.justifyContent;
    this.alignContent = data.alignContent;
    this.flexDirection = data.flexDirection;
    this.flexWrap = data.flexWrap;
    this.trackListColumns = data.trackListColumns;
    this.trackListRows = data.trackListRows;
    this.autoFlow = data.autoFlow;
    this.tableLayout = data.tableLayout;
    this.borderModel = data.borderModel;
    this.breakBefore = data.breakBefore;
    this.breakAfter = data.breakAfter;
    this.breakInside = data.breakInside;
    this.widows = data.widows;
    this.orphans = data.orphans;
  }
}

export function resolvedLineHeight(style: ComputedStyle): number {
  if (style.lineHeight <= 0) {
    return style.fontSize * 1.2;
  }
  if (style.lineHeight > 0 && style.lineHeight <= 10) {
    return style.lineHeight * style.fontSize;
  }
  return style.lineHeight;
}
