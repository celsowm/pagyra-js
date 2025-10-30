/**
 * Browser-like User Agent (UA) defaults for PDF conversion
 * Following Single Responsibility Principle - each section handles one concern
 */

import { Display, Position, FloatMode, ClearMode, OverflowMode, WhiteSpace, TextWrap, WritingMode, AlignItems, JustifyContent, AlignContent, TableLayoutMode, BorderModel } from "./enums.js";
import { AUTO_LENGTH } from "./length.js";
import type { LengthLike } from "./length.js";

export interface ElementDefaults {
  tagName: string;
  display: Display;
  margin?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  border?: number;
  borderTop?: number;
  borderRight?: number;
  borderBottom?: number;
  borderLeft?: number;
  fontSize: number;
  fontStyle?: string;
  lineHeight: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  listStyleType?: string;
  textAlign?: string;
  verticalAlign?: string;
  borderCollapse?: string;
  borderSpacing?: number;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  textDecorationLine?: string;
}

/**
 * Typography defaults - handles all font and text related properties
 */
export class TypographyDefaults {
  static getFontFamily(): string {
    return "Times, 'Times New Roman', serif";
  }

  static getFontSize(): number {
    return 16;
  }

  static getLineHeight(): number {
    return 1.2;
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

/**
 * Box model defaults - handles spacing, sizing, and positioning
 */
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

/**
 * Layout defaults - handles display and positioning properties
 */
export class LayoutDefaults {
  static getDisplay(): Display {
    return Display.Block;
  }

  static getPosition(): Position {
    return Position.Static;
  }

  static getFloat(): FloatMode {
    return FloatMode.None;
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

/**
 * Text layout defaults - handles text flow and wrapping
 */
export class TextLayoutDefaults {
  static getWhiteSpace(): WhiteSpace {
    return WhiteSpace.Normal;
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
}

/**
 * Element-specific defaults - comprehensive browser-like defaults for HTML elements
 */
export class ElementSpecificDefaults {
  private static readonly elementDefaults: Record<string, Partial<ElementDefaults>> = {
    // Root element
    html: {
      display: Display.Block,
      fontSize: 16,
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },

    // Body element
    body: {
      display: Display.Block,
      margin: 8,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },

    // Headings
    h1: {
      display: Display.Block,
      marginTop: TypographyDefaults.getFontSize() * 2 * 0.67,
      marginBottom: TypographyDefaults.getFontSize() * 2 * 0.67,
      marginLeft: 0,
      marginRight: 0,
      fontSize: TypographyDefaults.getFontSize() * 2,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      fontWeight: 700,
      color: TypographyDefaults.getColor(),
    },
    h2: {
      display: Display.Block,
      marginTop: TypographyDefaults.getFontSize() * 1.5 * 0.83,
      marginBottom: TypographyDefaults.getFontSize() * 1.5 * 0.83,
      marginLeft: 0,
      marginRight: 0,
      fontSize: TypographyDefaults.getFontSize() * 1.5,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      fontWeight: 700,
      color: TypographyDefaults.getColor(),
    },
    h3: {
      display: Display.Block,
      marginTop: TypographyDefaults.getFontSize() * 1.17,
      marginBottom: TypographyDefaults.getFontSize() * 1.17,
      marginLeft: 0,
      marginRight: 0,
      fontSize: TypographyDefaults.getFontSize() * 1.17,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      fontWeight: 700,
      color: TypographyDefaults.getColor(),
    },
    h4: {
      display: Display.Block,
      marginTop: TypographyDefaults.getFontSize() * 1.33,
      marginBottom: TypographyDefaults.getFontSize() * 1.33,
      marginLeft: 0,
      marginRight: 0,
      fontSize: TypographyDefaults.getFontSize(),
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      fontWeight: 700,
      color: TypographyDefaults.getColor(),
    },
    h5: {
      display: Display.Block,
      marginTop: TypographyDefaults.getFontSize() * 0.83 * 1.67,
      marginBottom: TypographyDefaults.getFontSize() * 0.83 * 1.67,
      marginLeft: 0,
      marginRight: 0,
      fontSize: TypographyDefaults.getFontSize() * 0.83,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      fontWeight: 700,
      color: TypographyDefaults.getColor(),
    },
    h6: {
      display: Display.Block,
      marginTop: TypographyDefaults.getFontSize() * 0.67 * 2.33,
      marginBottom: TypographyDefaults.getFontSize() * 0.67 * 2.33,
      marginLeft: 0,
      marginRight: 0,
      fontSize: TypographyDefaults.getFontSize() * 0.67,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      fontWeight: 700,
      color: TypographyDefaults.getColor(),
    },

    // Paragraphs
    p: {
      display: Display.Block,
      margin: 16,
      marginBottom: 16,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },

    // Lists
    ul: {
      display: Display.Block,
      margin: 16,
      marginBottom: 16,
      paddingLeft: 40,
      listStyleType: "disc",
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    ol: {
      display: Display.Block,
      margin: 16,
      marginBottom: 16,
      paddingLeft: 40,
      listStyleType: "decimal",
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    li: {
      display: Display.Block,
      marginBottom: 8,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },

    // Links
    a: {
      display: Display.Inline,
      color: "#0000EE",
      textAlign: "start",
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
    },

    // Text formatting
    strong: {
      display: Display.Inline,
      fontSize: 16,
      fontWeight: 700,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    em: {
      display: Display.Inline,
      fontSize: 16,
      fontStyle: "italic",
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    b: {
      display: Display.Inline,
      fontSize: 16,
      fontWeight: 700,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    i: {
      display: Display.Inline,
      fontSize: 16,
      fontStyle: "italic",
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    s: {
      display: Display.Inline,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
      textDecorationLine: "line-through",
    },
    del: {
      display: Display.Inline,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
      textDecorationLine: "line-through",
    },
    u: {
      display: Display.Inline,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
      textDecorationLine: "underline",
    },
    strike: {
      display: Display.Inline,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
      textDecorationLine: "line-through",
    },
    code: {
      display: Display.Inline,
      fontSize: 14,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: "Monaco, 'Courier New', monospace",
      color: TypographyDefaults.getColor(),
    },

    // Tables
    table: {
      display: Display.Table,
      borderCollapse: "separate",
      borderSpacing: 2,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    thead: {
      display: Display.TableHeaderGroup,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    tbody: {
      display: Display.TableRowGroup,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    tfoot: {
      display: Display.TableFooterGroup,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    tr: {
      display: Display.TableRow,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    th: {
      display: Display.TableCell,
      padding: 8,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
      fontWeight: 700,
      textAlign: "center",
      verticalAlign: "middle",
    },
    td: {
      display: Display.TableCell,
      padding: 8,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
      verticalAlign: "top",
    },

    // Form elements
    input: {
      display: Display.InlineBlock,
      padding: 2,
      border: 1,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    button: {
      display: Display.InlineBlock,
      padding: 2,
      border: 1,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    textarea: {
      display: Display.InlineBlock,
      padding: 2,
      border: 1,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },

    // Divs and containers
    div: {
      display: Display.Block,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    span: {
      display: Display.Inline,
      fontSize: 16,
      lineHeight: TypographyDefaults.getLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },

    // Images
    img: {
      display: Display.InlineBlock,
      border: 0,
    },

    // Breaks
    br: {
      display: Display.Inline,
    },
  };

  static getDefaultsForElement(tagName: string): Partial<ElementDefaults> {
    const normalizedTag = tagName.toLowerCase();
    return this.elementDefaults[normalizedTag] || {};
  }

  static getAllDefaults(): Record<string, Partial<ElementDefaults>> {
    return { ...this.elementDefaults };
  }
}

/**
 * Complete browser-like defaults factory
 */
export class BrowserDefaults {
  static createBaseDefaults(): any {
    return {
      // Typography
      fontFamily: TypographyDefaults.getFontFamily(),
      fontSize: TypographyDefaults.getFontSize(),
      fontWeight: TypographyDefaults.getFontWeight(),
      lineHeight: TypographyDefaults.getLineHeight(),
      color: TypographyDefaults.getColor(),
      letterSpacing: TypographyDefaults.getLetterSpacing(),
      wordSpacing: TypographyDefaults.getWordSpacing(),
      textDecorationLine: "none",
      listStyleType: "disc",

      // Box model
      marginTop: BoxModelDefaults.getMargin(),
      marginRight: BoxModelDefaults.getMargin(),
      marginBottom: BoxModelDefaults.getMargin(),
      marginLeft: BoxModelDefaults.getMargin(),
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

      // Layout
      display: LayoutDefaults.getDisplay(),
      position: LayoutDefaults.getPosition(),
      float: LayoutDefaults.getFloat(),
      clear: LayoutDefaults.getClear(),
      overflowX: LayoutDefaults.getOverflowX(),
      overflowY: LayoutDefaults.getOverflowY(),

      // Text layout
      whiteSpace: TextLayoutDefaults.getWhiteSpace(),
      textWrap: TextLayoutDefaults.getTextWrap(),
      writingMode: TextLayoutDefaults.getWritingMode(),
      textAlign: TextLayoutDefaults.getTextAlign(),
      verticalAlign: TextLayoutDefaults.getVerticalAlign(),

      // Flexbox (defaults)
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: AUTO_LENGTH,
      alignItems: AlignItems.Stretch,
      alignSelf: "auto",
      justifyContent: JustifyContent.FlexStart,
      alignContent: AlignContent.Stretch,
      flexDirection: "row",
      flexWrap: false,

      // Grid (defaults)
      trackListColumns: [],
      trackListRows: [],
      autoFlow: "row",

      // Table (defaults)
      tableLayout: TableLayoutMode.Auto,
      borderModel: BorderModel.Separate,

      // Fragmentation (defaults)
      breakBefore: "auto",
      breakAfter: "auto",
      breakInside: "auto",
      widows: 2,
      orphans: 2,
    };
  }

  static mergeElementDefaults(baseDefaults: any, elementDefaults: Partial<ElementDefaults>): any {
    const merged = { ...baseDefaults };

    if (elementDefaults.fontSize !== undefined) {
      merged.fontSize = elementDefaults.fontSize;
    }
    if (elementDefaults.fontStyle !== undefined) {
      merged.fontStyle = elementDefaults.fontStyle;
    }
    if (elementDefaults.lineHeight !== undefined) {
      merged.lineHeight = elementDefaults.lineHeight;
    }
    if (elementDefaults.fontFamily !== undefined) {
      merged.fontFamily = elementDefaults.fontFamily;
    }
    if (elementDefaults.fontWeight !== undefined) {
      merged.fontWeight = elementDefaults.fontWeight;
    }
    if (elementDefaults.color !== undefined) {
      merged.color = elementDefaults.color;
    }
    if (elementDefaults.margin !== undefined) {
      merged.marginTop = elementDefaults.margin;
      merged.marginRight = elementDefaults.margin;
      merged.marginBottom = elementDefaults.margin;
      merged.marginLeft = elementDefaults.margin;
    }
    if (elementDefaults.marginTop !== undefined) {
      merged.marginTop = elementDefaults.marginTop;
    }
    if (elementDefaults.marginRight !== undefined) {
      merged.marginRight = elementDefaults.marginRight;
    }
    if (elementDefaults.marginBottom !== undefined) {
      merged.marginBottom = elementDefaults.marginBottom;
    }
    if (elementDefaults.marginLeft !== undefined) {
      merged.marginLeft = elementDefaults.marginLeft;
    }
    if (elementDefaults.padding !== undefined) {
      merged.paddingTop = elementDefaults.padding;
      merged.paddingRight = elementDefaults.padding;
      merged.paddingBottom = elementDefaults.padding;
      merged.paddingLeft = elementDefaults.padding;
    }
    if (elementDefaults.paddingTop !== undefined) {
      merged.paddingTop = elementDefaults.paddingTop;
    }
    if (elementDefaults.paddingRight !== undefined) {
      merged.paddingRight = elementDefaults.paddingRight;
    }
    if (elementDefaults.paddingBottom !== undefined) {
      merged.paddingBottom = elementDefaults.paddingBottom;
    }
    if (elementDefaults.paddingLeft !== undefined) {
      merged.paddingLeft = elementDefaults.paddingLeft;
    }
    if (elementDefaults.border !== undefined) {
      merged.borderTop = elementDefaults.border;
      merged.borderRight = elementDefaults.border;
      merged.borderBottom = elementDefaults.border;
      merged.borderLeft = elementDefaults.border;
    }
    if (elementDefaults.borderTop !== undefined) {
      merged.borderTop = elementDefaults.borderTop;
    }
    if (elementDefaults.borderRight !== undefined) {
      merged.borderRight = elementDefaults.borderRight;
    }
    if (elementDefaults.borderBottom !== undefined) {
      merged.borderBottom = elementDefaults.borderBottom;
    }
    if (elementDefaults.borderLeft !== undefined) {
      merged.borderLeft = elementDefaults.borderLeft;
    }
    if (elementDefaults.display !== undefined) {
      merged.display = elementDefaults.display;
    }
    if (elementDefaults.objectFit !== undefined) {
      (merged as any).objectFit = elementDefaults.objectFit;
    }
    if (elementDefaults.textAlign !== undefined) {
      merged.textAlign = elementDefaults.textAlign;
    }
    if (elementDefaults.verticalAlign !== undefined) {
      merged.verticalAlign = elementDefaults.verticalAlign;
    }
    if (elementDefaults.listStyleType !== undefined) {
      merged.listStyleType = elementDefaults.listStyleType;
    }
    if (elementDefaults.textDecorationLine !== undefined) {
      (merged as any).textDecorationLine = elementDefaults.textDecorationLine;
    }
    if (elementDefaults.borderCollapse !== undefined) {
      merged.borderCollapse = elementDefaults.borderCollapse;
    }
    if (elementDefaults.borderSpacing !== undefined) {
      merged.borderSpacing = elementDefaults.borderSpacing;
    }

    return merged;
  }
}
