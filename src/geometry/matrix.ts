export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * Identity matrix (SVG/PDF convention: matrix(a,b,c,d,e,f) maps (x,y) -> (a*x + c*y + e, b*x + d*y + f))
 */
export function identityMatrix(): Matrix {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

/**
 * Multiply two matrices in the conventional SVG 3x3 representation.
 * Result = m1 * m2
 */
export function multiplyMatrices(m1: Matrix, m2: Matrix): Matrix {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

/**
 * Apply a matrix to a point (x,y) and return transformed coordinates.
 */
export function applyMatrixToPoint(matrix: Matrix, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

/**
 * Compute an approximate stroke scale for stroke-width adjustments based on a transform.
 * This mirrors prior behavior used by the codebase but kept generic here.
 */
export function computeStrokeScale(viewportMatrix: Matrix, transform: Matrix): number {
  const combined = multiplyMatrices(viewportMatrix, transform);
  const det = combined.a * combined.d - combined.b * combined.c;
  if (Number.isFinite(det) && det !== 0) {
    const scale = Math.sqrt(Math.abs(det));
    if (scale > 0) {
      return scale;
    }
  }
  const col1 = Math.hypot(combined.a, combined.b);
  const col2 = Math.hypot(combined.c, combined.d);
  const average = (col1 + col2) / 2;
  return average > 0 ? average : 1;
}
