import { identityMatrix, multiplyMatrices } from "../geometry/matrix.js";
import type { Matrix } from "../geometry/matrix.js";

/**
 * Parse CSS/SVG transform string into a Matrix using the SVG convention.
 * This parser follows the SVG/CSS syntax and semantics and does NOT adapt
 * the resulting matrix to any target coordinate system (e.g., PDF).
 *
 * Returned matrix components are in the same units as the input values
 * (typically px for translate).
 */
export function parseTransform(raw: string | undefined): Matrix | null {
  if (!raw) {
    return null;
  }
  const regex = /([a-zA-Z]+)\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  let current = identityMatrix();
  let found = false;
  while ((match = regex.exec(raw)) !== null) {
    const type = match[1].toLowerCase();
    const params = parseNumberList(match[2]);
    const matrix = transformFromValues(type, params);
    if (matrix) {
      current = multiplyMatrices(current, matrix);
      found = true;
    }
  }
  return found ? current : null;
}

function transformFromValues(type: string, values: number[]): Matrix | null {
  switch (type) {
    case "matrix":
      if (values.length >= 6) {
        return {
          a: values[0],
          b: values[1],
          c: values[2],
          d: values[3],
          e: values[4],
          f: values[5],
        };
      }
      return null;
    case "translate": {
      const tx = Number.isFinite(values[0]) ? values[0] : 0;
      const ty = Number.isFinite(values[1]) ? values[1] : 0;
      return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
    }
    case "scale": {
      const sx = Number.isFinite(values[0]) ? values[0] : 1;
      const sy = Number.isFinite(values[1]) ? values[1] : sx;
      return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
    }
    case "rotate": {
      // SVG rotate(angle [, cx, cy])
      const angle = (Number.isFinite(values[0]) ? values[0] : 0) * (Math.PI / 180);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      let base: Matrix = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
      if (values.length >= 3 && Number.isFinite(values[1]) && Number.isFinite(values[2])) {
        const cx = values[1];
        const cy = values[2];
        const translateTo: Matrix = { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy };
        const translateBack: Matrix = { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy };
        base = multiplyMatrices(translateTo, multiplyMatrices(base, translateBack));
      }
      return base;
    }
    case "skewx": {
      const angle = (Number.isFinite(values[0]) ? values[0] : 0) * (Math.PI / 180);
      return { a: 1, b: 0, c: Math.tan(angle), d: 1, e: 0, f: 0 };
    }
    case "skewy": {
      const angle = (Number.isFinite(values[0]) ? values[0] : 0) * (Math.PI / 180);
      return { a: 1, b: Math.tan(angle), c: 0, d: 1, e: 0, f: 0 };
    }
    default:
      return null;
  }
}

function parseNumberList(value: string): number[] {
  const result: number[] = [];
  const regex = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    const parsed = Number.parseFloat(match[0]);
    if (Number.isFinite(parsed)) {
      result.push(parsed);
    }
  }
  return result;
}
