export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export function identityMatrix(): Matrix {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

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

export function applyMatrixToPoint(matrix: Matrix, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

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
