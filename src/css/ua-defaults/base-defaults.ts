import {
  AlignContent,
  AlignItems,
  BorderModel,
  BoxSizing,
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
} from "../enums.js";
import type { LengthLike } from "../length.js";
import { AUTO_LENGTH } from "../length.js";
import { createNormalLineHeight, DEFAULT_NORMAL_LINE_HEIGHT } from "../line-height.js";
import { remToPx, emToPx } from "../unit-conversion.js";
import type { StyleDefaults } from "./types.js";

export class TypographyDefaults {
  static getFontFamily(): string {
    return "'Times New Roman', Times, serif";
  }

  static getFontSize(): number {
    return 1;
  }

  static getBaseFontSize(): number {
    return 16;
  }

  static getLineHeight(): number {
    return DEFAULT_NORMAL_LINE_HEIGHT;
  }

  static getColor(): string {
    return "#000000";
  }

  static getLetterSpacing(): number {
    return 0;
  }

  static getWordSpacing(): number {
    return 0;
  }

  static getFontWeight(): number {
    return 400;
  }
}

export class BoxModelDefaults {
  static getMargin(): number {
    return 0;
  }

  static getPadding(): number {
    return 0;
  }

  static getBorder(): number {
    return 0;
  }

  static getWidth(): LengthLike {
    return "auto";
  }

  static getHeight(): LengthLike {
    return "auto";
  }

  static getMinWidth(): LengthLike | undefined {
    return undefined;
  }

  static getMaxWidth(): LengthLike | undefined {
    return undefined;
  }

  static getMinHeight(): LengthLike | undefined {
    return undefined;
  }

  static getMaxHeight(): LengthLike | undefined {
    return undefined;
  }
}

export class LayoutDefaults {
  static getDisplay(): Display {
    return Display.Block;
  }

  static getPosition(): Position {
    return Position.Static;
  }

  static getFloat(): "none" {
    return "none";
  }

  static getClear(): ClearMode {
    return ClearMode.None;
  }

  static getOverflowX(): OverflowMode {
    return OverflowMode.Visible;
  }

  static getOverflowY(): OverflowMode {
    return OverflowMode.Visible;
  }
}

export class TextLayoutDefaults {
  static getWhiteSpace(): WhiteSpace {
    return WhiteSpace.Normal;
  }

  static getOverflowWrap(): "normal" | "break-word" | "anywhere" {
    return "normal";
  }

  static getWordBreak(): "normal" | "break-all" | "keep-all" | "break-word" {
    return "normal";
  }

  static getTextWrap(): TextWrap {
    return TextWrap.Wrap;
  }

  static getWritingMode(): WritingMode {
    return WritingMode.HorizontalTb;
  }

  static getTextAlign(): string {
    return "start";
  }

  static getVerticalAlign(): string {
    return "baseline";
  }

  static getTextIndent(): number {
    return 0;
  }

  static getTextTransform(): "none" {
    return "none";
  }
}

export function createBaseDefaultsObject(): StyleDefaults {
  const baseFontSize = TypographyDefaults.getBaseFontSize();
  return {
    fontFamily: TypographyDefaults.getFontFamily(),
    fontSize: remToPx(TypographyDefaults.getFontSize(), baseFontSize),
    fontStyle: "normal",
    fontWeight: TypographyDefaults.getFontWeight(),
    lineHeight: createNormalLineHeight(),
    color: TypographyDefaults.getColor(),
    borderColor: TypographyDefaults.getColor(),
    letterSpacing: TypographyDefaults.getLetterSpacing(),
    wordSpacing: TypographyDefaults.getWordSpacing(),
    textDecorationLine: "none",
    textDecorationColor: "currentcolor",
    textDecorationStyle: "solid",
    listStyleType: "disc",

    marginTop: emToPx(BoxModelDefaults.getMargin(), remToPx(TypographyDefaults.getFontSize(), baseFontSize)),
    marginRight: emToPx(BoxModelDefaults.getMargin(), remToPx(TypographyDefaults.getFontSize(), baseFontSize)),
    marginBottom: emToPx(BoxModelDefaults.getMargin(), remToPx(TypographyDefaults.getFontSize(), baseFontSize)),
    marginLeft: emToPx(BoxModelDefaults.getMargin(), remToPx(TypographyDefaults.getFontSize(), baseFontSize)),
    paddingTop: BoxModelDefaults.getPadding(),
    paddingRight: BoxModelDefaults.getPadding(),
    paddingBottom: BoxModelDefaults.getPadding(),
    paddingLeft: BoxModelDefaults.getPadding(),
    borderTop: BoxModelDefaults.getBorder(),
    borderRight: BoxModelDefaults.getBorder(),
    borderBottom: BoxModelDefaults.getBorder(),
    borderLeft: BoxModelDefaults.getBorder(),
    borderTopLeftRadiusX: 0,
    borderTopLeftRadiusY: 0,
    borderTopRightRadiusX: 0,
    borderTopRightRadiusY: 0,
    borderBottomRightRadiusX: 0,
    borderBottomRightRadiusY: 0,
    borderBottomLeftRadiusX: 0,
    borderBottomLeftRadiusY: 0,
    boxShadows: [],
    width: BoxModelDefaults.getWidth(),
    height: BoxModelDefaults.getHeight(),
    minWidth: BoxModelDefaults.getMinWidth(),
    maxWidth: BoxModelDefaults.getMaxWidth(),
    minHeight: BoxModelDefaults.getMinHeight(),
    maxHeight: BoxModelDefaults.getMaxHeight(),

    boxSizing: BoxSizing.ContentBox,
    display: LayoutDefaults.getDisplay(),
    position: LayoutDefaults.getPosition(),
    float: FloatMode.None,
    clear: LayoutDefaults.getClear(),
    visibility: "visible",
    overflowX: LayoutDefaults.getOverflowX(),
    overflowY: LayoutDefaults.getOverflowY(),

    whiteSpace: TextLayoutDefaults.getWhiteSpace(),
    overflowWrap: TextLayoutDefaults.getOverflowWrap(),
    wordBreak: TextLayoutDefaults.getWordBreak(),
    textWrap: TextLayoutDefaults.getTextWrap(),
    writingMode: TextLayoutDefaults.getWritingMode(),
    textAlign: TextLayoutDefaults.getTextAlign(),
    verticalAlign: TextLayoutDefaults.getVerticalAlign(),
    textIndent: TextLayoutDefaults.getTextIndent(),
    textTransform: TextLayoutDefaults.getTextTransform(),

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
    gridColumnSpan: 1,
    rowGap: 0,
    columnGap: 0,

    tableLayout: TableLayoutMode.Auto,
    borderModel: BorderModel.Separate,

    breakBefore: "auto",
    breakAfter: "auto",
    breakInside: "auto",
    widows: 2,
    orphans: 2,

    opacity: 1,
    filter: undefined,
    backdropFilter: undefined,
  };
}
