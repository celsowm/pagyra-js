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
import { BrowserDefaults, ElementSpecificDefaults } from "./browser-defaults.js";
import type { BackgroundLayer } from "./background-types.js";

export type FlexDirection = "row" | "row-reverse" | "column" | "column-reverse";
export type GridAutoFlow = "row" | "column" | "row dense" | "column dense";
export type AlignSelfValue = AlignItems | "auto";
export type OverflowWrap = "normal" | "break-word" | "anywhere";

export interface FixedTrackSize {
  kind: "fixed";
  size: number;
}

export interface FlexTrackSize {
  kind: "flex";
  flex: number;
  min?: number;
  max?: number;
}

export interface AutoTrackSize {
  kind: "auto";
  min?: number;
  max?: number;
}

export type TrackSize = FixedTrackSize | FlexTrackSize | AutoTrackSize;

export interface RepeatTrackDefinition {
  kind: "repeat";
  count: number;
  track: TrackSize;
}

export interface AutoRepeatTrackDefinition {
  kind: "repeat-auto";
  mode: "auto-fit" | "auto-fill";
  track: TrackSize;
}

export type TrackDefinition = TrackSize | RepeatTrackDefinition | AutoRepeatTrackDefinition;

export interface BoxShadow {
  inset: boolean;
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadRadius: number;
  color?: string;
}

// src/css/apply-declarations.ts
export interface StyleAccumulator {
  display?: Display;
  position?: Position;
  float?: string;
  color?: string;
  backgroundLayers?: BackgroundLayer[];
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
  width?: LengthLike;
  minWidth?: LengthLike;
  height?: LengthLike;
  minHeight?: LengthLike;
  maxHeight?: LengthLike;
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
  fontStyle?: string;
  fontVariant?: string;
  fontWeight?: number;
  borderModel?: BorderModel;
  maxWidth?: LengthLike;
  textAlign?: string;
  objectFit?: string;

  textDecorationLine?: string;
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;
  alignContent?: AlignContent;
  alignSelf?: AlignSelfValue;
  flexDirection?: FlexDirection;
  flexWrap?: boolean;
  overflowWrap?: OverflowWrap;
  trackListColumns?: TrackDefinition[];
  trackListRows?: TrackDefinition[];
  autoFlow?: GridAutoFlow;
  rowGap?: number;
  columnGap?: number;
  zIndex?: number | "auto";
  top?: LengthLike;
  right?: LengthLike;
  bottom?: LengthLike;
  left?: LengthLike;
}

export interface StyleProperties {
  textAlign?: string;
  verticalAlign?: string;
  textDecorationLine?: string;
  display: Display;
  position: Position;
  zIndex: number | "auto";
  float: FloatMode;
  clear: ClearMode;
  overflowX: OverflowMode;
  overflowY: OverflowMode;
  whiteSpace: WhiteSpace;
  textWrap: TextWrap;
  overflowWrap: OverflowWrap;
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
  borderTopLeftRadiusX: number;
  borderTopLeftRadiusY: number;
  borderTopRightRadiusX: number;
  borderTopRightRadiusY: number;
  borderBottomRightRadiusX: number;
  borderBottomRightRadiusY: number;
  borderBottomLeftRadiusX: number;
  borderBottomLeftRadiusY: number;
  backgroundLayers?: BackgroundLayer[];  // fonte da verdade
  borderColor?: string;
  boxShadows: BoxShadow[];
  color?: string;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: string;
  fontVariant?: string;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
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
  listStyleType: string;
  alignItems: AlignItems;
  alignSelf: AlignSelfValue;
  justifyContent: JustifyContent;
  alignContent: AlignContent;
  flexDirection: FlexDirection;
  flexWrap: boolean;
  trackListColumns: TrackDefinition[];
  trackListRows: TrackDefinition[];
  autoFlow: GridAutoFlow;
  rowGap: number;
  columnGap: number;
  tableLayout: TableLayoutMode;
  borderModel: BorderModel;
  breakBefore: string;
  breakAfter: string;
  breakInside: string;
  widows: number;
  orphans: number;
}

const defaultStyle = BrowserDefaults.createBaseDefaults() as StyleProperties;

export class ComputedStyle implements StyleProperties {
  textAlign?: string;
  verticalAlign?: string;
  textDecorationLine?: string;
  display: Display;
  position: Position;
  zIndex: number | "auto";
  float: FloatMode;
  clear: ClearMode;
  overflowX: OverflowMode;
  overflowY: OverflowMode;
  whiteSpace: WhiteSpace;
  textWrap: TextWrap;
  overflowWrap: OverflowWrap;
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
  borderTopLeftRadiusX: number;
  borderTopLeftRadiusY: number;
  borderTopRightRadiusX: number;
  borderTopRightRadiusY: number;
  borderBottomRightRadiusX: number;
  borderBottomRightRadiusY: number;
  borderBottomLeftRadiusX: number;
  borderBottomLeftRadiusY: number;
  backgroundLayers?: BackgroundLayer[];
  borderColor?: string;
  boxShadows: BoxShadow[];
  color?: string;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: string;
  fontVariant?: string;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
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
  listStyleType: string;
  alignItems: AlignItems;
  alignSelf: AlignSelfValue;
  justifyContent: JustifyContent;
  alignContent: AlignContent;
  flexDirection: FlexDirection;
  flexWrap: boolean;
  trackListColumns: TrackDefinition[];
  trackListRows: TrackDefinition[];
  autoFlow: GridAutoFlow;
  rowGap: number;
  columnGap: number;
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
      backgroundLayers: init?.backgroundLayers ? [...init.backgroundLayers] : [],
    };

    this.display = data.display;
    this.position = data.position;
    this.zIndex = data.zIndex;
    this.float = data.float;
    this.clear = data.clear;
    this.overflowX = data.overflowX;
    this.overflowY = data.overflowY;
    this.whiteSpace = data.whiteSpace;
    this.overflowWrap = data.overflowWrap;
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
    this.borderTopLeftRadiusX = data.borderTopLeftRadiusX;
    this.borderTopLeftRadiusY = data.borderTopLeftRadiusY;
    this.borderTopRightRadiusX = data.borderTopRightRadiusX;
    this.borderTopRightRadiusY = data.borderTopRightRadiusY;
    this.borderBottomRightRadiusX = data.borderBottomRightRadiusX;
    this.borderBottomRightRadiusY = data.borderBottomRightRadiusY;
    this.borderBottomLeftRadiusX = data.borderBottomLeftRadiusX;
    this.borderBottomLeftRadiusY = data.borderBottomLeftRadiusY;
    this.backgroundLayers = data.backgroundLayers;
    this.borderColor = data.borderColor;
    this.boxShadows = [...data.boxShadows];
    this.color = data.color;
    this.fontFamily = data.fontFamily;
    this.fontWeight = data.fontWeight;
    this.fontStyle = data.fontStyle;
    this.fontVariant = data.fontVariant;
    this.objectFit = data.objectFit;
    this.zIndex = data.zIndex;
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
    this.listStyleType = data.listStyleType;
    this.alignItems = data.alignItems;
    this.alignSelf = data.alignSelf;
    this.justifyContent = data.justifyContent;
    this.alignContent = data.alignContent;
    this.flexDirection = data.flexDirection;
    this.flexWrap = data.flexWrap;
    this.trackListColumns = data.trackListColumns;
    this.trackListRows = data.trackListRows;
    this.autoFlow = data.autoFlow;
    this.rowGap = data.rowGap;
    this.columnGap = data.columnGap;
    this.tableLayout = data.tableLayout;
    this.borderModel = data.borderModel;
    this.breakBefore = data.breakBefore;
    this.breakAfter = data.breakAfter;
    this.breakInside = data.breakInside;
    this.widows = data.widows;
    this.orphans = data.orphans;
    this.textAlign = init?.textAlign ?? undefined;
    this.verticalAlign = init?.verticalAlign ?? undefined;
    this.textDecorationLine = init?.textDecorationLine ?? defaultStyle.textDecorationLine;
  }

  get backgroundColor(): string | undefined {
    if (!this.backgroundLayers) return undefined;
    for (let i = this.backgroundLayers.length - 1; i >= 0; i--) {
      const layer = this.backgroundLayers[i];
      if (layer.kind === 'color') {
        return layer.color;
      }
    }
    return undefined;
  }
}

export function resolvedLineHeight(style: any): number {
  if (!style || !style.fontSize) {
    return 16;
  }
  if (!style.lineHeight || style.lineHeight <= 0) {
    return style.fontSize * 1.2;
  }
  if (style.lineHeight > 0 && style.lineHeight <= 10) {
    return style.lineHeight * style.fontSize;
  }
  return style.lineHeight;
}
