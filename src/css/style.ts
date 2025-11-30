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
import type { LengthInput, LengthLike, RelativeLength, NumericLength } from "./length.js";
import { BrowserDefaults } from "./browser-defaults.js";
import type { BackgroundLayer } from "./background-types.js";
import {
  cloneLineHeight,
  lineHeightToPx,
  type LineHeightInput,
  type LineHeightValue,
} from "./line-height.js";
import { CustomPropertiesMap } from "./custom-properties.js";

// Import domain interfaces
import type { LayoutProperties } from "./properties/layout.js";
import type { TypographyProperties, TextTransform, OverflowWrap } from "./properties/typography.js";
import type { BoxModelProperties } from "./properties/box-model.js";
import type { FlexboxProperties, FlexDirection, AlignSelfValue } from "./properties/flexbox.js";
import type {
  GridProperties,
  GridAutoFlow,
  TrackSize,
  TrackDefinition,
  FixedTrackSize,
  FlexTrackSize,
  AutoTrackSize,
  RepeatTrackDefinition,
  AutoRepeatTrackDefinition,
  TrackSizeInput,
  TrackDefinitionInput,
  FixedTrackSizeInput,
  FlexTrackSizeInput,
  AutoTrackSizeInput,
  RepeatTrackDefinitionInput,
  AutoRepeatTrackDefinitionInput,
} from "./properties/grid.js";
import type {
  VisualProperties,
  BoxShadow,
  BoxShadowInput,
  TextShadow,
  TextShadowInput,
} from "./properties/visual.js";
import type { MiscProperties } from "./properties/misc.js";
import type { ClipPath } from "./clip-path-types.js";

// Re-export types for convenience
export type { NumericLength } from "./length.js";
export type { LineHeightInput, LineHeightValue } from "./line-height.js";
export type { TextTransform, OverflowWrap };
export type { FlexDirection, AlignSelfValue };
export type { GridAutoFlow };
export type {
  TrackSize,
  TrackDefinition,
  FixedTrackSize,
  FlexTrackSize,
  AutoTrackSize,
  RepeatTrackDefinition,
  AutoRepeatTrackDefinition,
  TrackSizeInput,
  TrackDefinitionInput,
  FixedTrackSizeInput,
  FlexTrackSizeInput,
  AutoTrackSizeInput,
  RepeatTrackDefinitionInput,
  AutoRepeatTrackDefinitionInput,
};
export type { BoxShadow, BoxShadowInput, TextShadow, TextShadowInput };


// src/css/apply-declarations.ts
export interface StyleAccumulator {
  display?: Display;
  position?: Position;
  float?: string;
  color?: string;
  textDecorationColor?: string;
  textDecorationStyle?: string;
  backgroundLayers?: BackgroundLayer[];
  borderColor?: string;
  boxShadows?: BoxShadowInput[];
  textShadows?: TextShadowInput[];
  transform?: string;
  clipPath?: ClipPath;
  borderTop?: LengthInput;
  borderRight?: LengthInput;
  borderBottom?: LengthInput;
  borderLeft?: LengthInput;
  borderTopLeftRadiusX?: NumericLength;
  borderTopLeftRadiusY?: NumericLength;
  borderTopRightRadiusX?: NumericLength;
  borderTopRightRadiusY?: NumericLength;
  borderBottomRightRadiusX?: NumericLength;
  borderBottomRightRadiusY?: NumericLength;
  borderBottomLeftRadiusX?: NumericLength;
  borderBottomLeftRadiusY?: NumericLength;
  borderStyleTop?: string;
  borderStyleRight?: string;
  borderStyleBottom?: string;
  borderStyleLeft?: string;
  marginTop?: LengthInput;
  marginRight?: LengthInput;
  marginBottom?: LengthInput;
  marginLeft?: LengthInput;
  paddingTop?: LengthInput;
  paddingRight?: LengthInput;
  paddingBottom?: LengthInput;
  paddingLeft?: LengthInput;
  width?: LengthInput;
  minWidth?: LengthInput;
  height?: LengthInput;
  minHeight?: LengthInput;
  maxHeight?: LengthInput;
  fontSize?: number | RelativeLength;
  lineHeight?: LineHeightInput;
  fontFamily?: string;
  fontStyle?: string;
  fontVariant?: string;
  fontWeight?: number;
  letterSpacing?: number | RelativeLength;
  borderModel?: BorderModel;
  maxWidth?: LengthInput;
  textAlign?: string;
  textIndent?: LengthInput;
  textTransform?: TextTransform;
  listStyleType?: string;
  objectFit?: string;

  textDecorationLine?: string;
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;
  alignContent?: AlignContent;
  alignSelf?: AlignSelfValue;
  flexDirection?: FlexDirection;
  flexWrap?: boolean;
  overflowWrap?: OverflowWrap;
  trackListColumns?: TrackDefinitionInput[];
  trackListRows?: TrackDefinitionInput[];
  autoFlow?: GridAutoFlow;
  rowGap?: NumericLength;
  columnGap?: NumericLength;
  zIndex?: number | "auto";
  top?: LengthInput;
  right?: LengthInput;
  bottom?: LengthInput;
  left?: LengthInput;
  opacity?: number;
}

/**
 * Complete CSS style properties.
 * Composed from focused domain interfaces for better organization and maintainability.
 */
export type StyleProperties =
  LayoutProperties &
  TypographyProperties &
  BoxModelProperties &
  FlexboxProperties &
  GridProperties &
  VisualProperties &
  MiscProperties;


const defaultStyle = BrowserDefaults.createBaseDefaults() as StyleProperties;

export class ComputedStyle implements StyleProperties {
  textAlign?: string;
  verticalAlign?: string;
  textDecorationLine?: string;
  textDecorationColor?: string;
  textDecorationStyle?: string;
  textIndent: LengthLike;
  textTransform: TextTransform;
  transform?: string;
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
  borderStyleTop?: string;
  borderStyleRight?: string;
  borderStyleBottom?: string;
  borderStyleLeft?: string;
  backgroundLayers?: BackgroundLayer[];
  borderColor?: string;
  boxShadows: BoxShadow[];
  textShadows: TextShadow[];
  color?: string;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: string;
  fontVariant?: string;
  clipPath?: ClipPath;
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
  lineHeight: LineHeightValue;
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
  opacity: number;
  customProperties: CustomPropertiesMap;

  constructor(init?: Partial<StyleProperties>) {
    const data: StyleProperties = {
      ...defaultStyle,
      ...init,
      flexBasis: init?.flexBasis ?? defaultStyle.flexBasis,
      trackListColumns: [...(init?.trackListColumns ?? defaultStyle.trackListColumns)],
      trackListRows: [...(init?.trackListRows ?? defaultStyle.trackListRows)],
      backgroundLayers: init?.backgroundLayers ? [...init.backgroundLayers] : [],
      textShadows: init?.textShadows ? [...init.textShadows] : [],
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
    this.borderStyleTop = data.borderStyleTop;
    this.borderStyleRight = data.borderStyleRight;
    this.borderStyleBottom = data.borderStyleBottom;
    this.borderStyleLeft = data.borderStyleLeft;
    this.backgroundLayers = data.backgroundLayers;
    this.borderColor = data.borderColor;
    this.boxShadows = [...data.boxShadows];
    this.textShadows = [...data.textShadows];
    this.color = data.color;
    this.fontFamily = data.fontFamily;
    this.fontWeight = data.fontWeight;
    this.fontStyle = data.fontStyle;
    this.fontVariant = data.fontVariant;
    this.clipPath = data.clipPath;
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
    this.lineHeight = cloneLineHeight(data.lineHeight);
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
    this.textIndent = data.textIndent;
    this.textTransform = data.textTransform;
    this.transform = init?.transform ?? undefined;
    this.textAlign = init?.textAlign ?? undefined;
    this.verticalAlign = init?.verticalAlign ?? undefined;
    this.textDecorationLine = init?.textDecorationLine ?? defaultStyle.textDecorationLine;
    this.textDecorationColor = init?.textDecorationColor ?? defaultStyle.textDecorationColor;
    this.textDecorationStyle = init?.textDecorationStyle ?? defaultStyle.textDecorationStyle;
    this.opacity = data.opacity;
    this.customProperties = init?.customProperties ?? new CustomPropertiesMap();
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

export function resolvedLineHeight(style: { lineHeight?: LineHeightValue; fontSize?: number } | null | undefined): number {
  return lineHeightToPx(style?.lineHeight, style?.fontSize);
}
