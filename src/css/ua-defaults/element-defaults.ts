import {
  Display,
} from "../enums.js";
import { createNormalLineHeight } from "../line-height.js";
import { TypographyDefaults } from "./base-defaults.js";
import type { ElementDefaults } from "./types.js";

/**
 * Element-specific defaults - browser-like defaults per HTML tag.
 * Pure data + simple lookup helpers, no construction/merge logic here.
 */
class ElementSpecificDefaultsImpl {
  private readonly elementDefaults: Record<string, Partial<ElementDefaults>> = {
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
      lineHeight: createNormalLineHeight(),
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
      lineHeight: createNormalLineHeight(),
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
      lineHeight: createNormalLineHeight(),
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
      lineHeight: createNormalLineHeight(),
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
      lineHeight: createNormalLineHeight(),
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
      lineHeight: createNormalLineHeight(),
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
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      fontWeight: 700,
      color: TypographyDefaults.getColor(),
    },

    // Paragraphs
    p: {
      display: Display.Block,
      marginTop: 16,
      marginRight: 0,
      marginBottom: 16,
      marginLeft: 0,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
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
      lineHeight: createNormalLineHeight(),
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
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    li: {
      display: Display.Block,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },

    // Links
    a: {
      display: Display.Inline,
      color: "#0000EE",
      textAlign: "start",
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
    },

    // Text formatting
    strong: {
      display: Display.Inline,
      fontSize: 16,
      fontWeight: 700,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    em: {
      display: Display.Inline,
      fontSize: 16,
      fontStyle: "italic",
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    b: {
      display: Display.Inline,
      fontSize: 16,
      fontWeight: 700,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    i: {
      display: Display.Inline,
      fontSize: 16,
      fontStyle: "italic",
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    s: {
      display: Display.Inline,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
      textDecorationLine: "line-through",
    },
    del: {
      display: Display.Inline,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
      textDecorationLine: "line-through",
    },
    u: {
      display: Display.Inline,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
      textDecorationLine: "underline",
    },
    strike: {
      display: Display.Inline,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
      textDecorationLine: "line-through",
    },
    code: {
      display: Display.Inline,
      fontSize: 14,
      lineHeight: createNormalLineHeight(),
      fontFamily: "Monaco, 'Courier New', monospace",
      color: TypographyDefaults.getColor(),
    },

    // Tables
    table: {
      display: Display.Table,
      borderCollapse: "separate",
      borderSpacing: 2,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    thead: {
      display: Display.TableHeaderGroup,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    tbody: {
      display: Display.TableRowGroup,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    tfoot: {
      display: Display.TableFooterGroup,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    tr: {
      display: Display.TableRow,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    th: {
      display: Display.TableCell,
      padding: 8,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
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
      lineHeight: createNormalLineHeight(),
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
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    button: {
      display: Display.InlineBlock,
      padding: 2,
      border: 1,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    textarea: {
      display: Display.InlineBlock,
      padding: 2,
      border: 1,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },

    // Divs and containers
    div: {
      display: Display.Block,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
      fontFamily: TypographyDefaults.getFontFamily(),
      color: TypographyDefaults.getColor(),
    },
    span: {
      display: Display.Inline,
      fontSize: 16,
      lineHeight: createNormalLineHeight(),
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

  getDefaultsForElement(tagName: string): Partial<ElementDefaults> {
    const normalizedTag = tagName.toLowerCase();
    return this.elementDefaults[normalizedTag] || {};
  }

  getAllDefaults(): Record<string, Partial<ElementDefaults>> {
    return { ...this.elementDefaults };
  }
}

const instance = new ElementSpecificDefaultsImpl();

/**
 * Public, SRP-focused API:
 * - data and simple queries only
 */
export class ElementSpecificDefaults {
  static getDefaultsForElement(tagName: string): Partial<ElementDefaults> {
    return instance.getDefaultsForElement(tagName);
  }

  static getAllDefaults(): Record<string, Partial<ElementDefaults>> {
    return instance.getAllDefaults();
  }
}
