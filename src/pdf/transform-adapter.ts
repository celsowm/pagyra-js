import type { Matrix } from "../geometry/matrix.js";
import { multiplyMatrices, identityMatrix } from "../geometry/matrix.js";

/**
 * Convert an SVG/CSS matrix (y-down coordinate system) into a matrix suitable
 * for use in PDF content streams (y-up coordinate system) by conjugating with
 * a Y-flip matrix: M_pdf = F * M_svg * F, where F = diag(1, -1).
 *
 * This flips the signs of the shear components (b and c) and the vertical
 * translation (f) so that when the matrix is later emitted directly into a
 * PDF text matrix (Tm) the visual result matches the original SVG/CSS.
 */
export function svgMatrixToPdf(matrix: Matrix | null): Matrix | null {
  if (!matrix) return null;
  // Flip Y matrix F
  const F: Matrix = { a: 1, b: 0, c: 0, d: -1, e: 0, f: 0 };
  // M' = F * M * F
  return multiplyMatrices(multiplyMatrices(F, matrix), F);
}

/**
 * Identity adapter (when no transform present).
 */
export function identityAdapter(): Matrix {
  return identityMatrix();
}
