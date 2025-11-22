/**
 * Base14 font widths aggregator.
 * 
 * This module imports and aggregates character width data for all Base14 fonts.
 * Each font's data is maintained in a separate module for better SRP and modularity.
 */

import type { Base14WidthsMap } from "./base14/widths-types.js";
import { TIMES_ROMAN_WIDTHS } from "./base14/widths-times-roman.js";
import { TIMES_BOLD_WIDTHS } from "./base14/widths-times-bold.js";
import { HELVETICA_WIDTHS } from "./base14/widths-helvetica.js";
import { HELVETICA_BOLD_WIDTHS } from "./base14/widths-helvetica-bold.js";
import { COURIER_WIDTHS } from "./base14/widths-courier.js";
import { COURIER_BOLD_WIDTHS } from "./base14/widths-courier-bold.js";

/**
 * Complete mapping of Base14 font names to their character width data.
 * Widths are expressed in 1/1000ths of the font size.
 * 
 * This maintains backward compatibility with the original base14Widths export.
 */
export const base14Widths: Record<string, Record<number, number>> = {
  "Times-Roman": TIMES_ROMAN_WIDTHS,
  "Times-Bold": TIMES_BOLD_WIDTHS,
  "Helvetica": HELVETICA_WIDTHS,
  "Helvetica-Bold": HELVETICA_BOLD_WIDTHS,
  "Courier": COURIER_WIDTHS,
  "Courier-Bold": COURIER_BOLD_WIDTHS
};

// Re-export types for consumers
export type { Base14FontName, Base14WidthsMap, WidthMap } from "./base14/widths-types.js";
