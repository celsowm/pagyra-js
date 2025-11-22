/**
 * Type definitions for Base14 font widths.
 */

/**
 * Base14 font names available in this project.
 */
export type Base14FontName =
    | "Times-Roman"
    | "Times-Bold"
    | "Helvetica"
    | "Helvetica-Bold"
    | "Courier"
    | "Courier-Bold";

/**
 * Map of character codes to their widths (in 1/1000ths of the font size).
 * Keys can be character codes or "-1" for missing glyphs.
 */
export type WidthMap = Record<string, number>;

/**
 * Complete map of all Base14 fonts to their width data.
 */
export type Base14WidthsMap = Record<Base14FontName, WidthMap>;
