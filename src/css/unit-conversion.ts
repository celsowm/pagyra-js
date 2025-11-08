/**
 * Utility functions for CSS unit conversions.
 * This module centralizes logic for converting between different units like rem, em, and px.
 */

/**
 * Converts a value from rem units to pixels.
 * @param remValue The value in rem units.
 * @param baseFontSize The base font size of the root element in pixels.
 * @returns The equivalent value in pixels.
 */
export function remToPx(remValue: number, baseFontSize: number): number {
  return remValue * baseFontSize;
}

/**
 * Converts a value from em units to pixels.
 * @param emValue The value in em units.
 * @param currentFontSize The font size of the current element in pixels.
 * @returns The equivalent value in pixels.
 */
export function emToPx(emValue: number, currentFontSize: number): number {
  return emValue * currentFontSize;
}
