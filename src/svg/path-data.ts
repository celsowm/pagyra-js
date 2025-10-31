export type NormalizedPathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Z" };

export function parsePathData(data: string | null | undefined): NormalizedPathCommand[] {
  if (!data) {
    return [];
  }
  const parser = new PathDataParser(data);
  return parser.parse();
}

class PathDataParser {
  private readonly source: string;
  private index = 0;

  constructor(data: string) {
    this.source = data;
  }

  parse(): NormalizedPathCommand[] {
    const segments: NormalizedPathCommand[] = [];
    let currentCommand: string | null = null;
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;
    let prevCubicControlX: number | null = null;
    let prevCubicControlY: number | null = null;
    let prevQuadControlX: number | null = null;
    let prevQuadControlY: number | null = null;

    while (true) {
      this.skipSeparators();
      if (this.isDone()) {
        break;
      }
      const char = this.peekChar();
      if (char !== null && isCommandLetter(char)) {
        currentCommand = char;
        this.index += 1;
      } else if (!currentCommand) {
        // Invalid data – nothing we can do.
        break;
      }

      switch (currentCommand) {
        case "M":
        case "m": {
          const isRelative = currentCommand === "m";
          const firstPoint = this.readCoordinatePair();
          if (!firstPoint) {
            return segments;
          }
          currentX = isRelative ? currentX + firstPoint.x : firstPoint.x;
          currentY = isRelative ? currentY + firstPoint.y : firstPoint.y;
          startX = currentX;
          startY = currentY;
          segments.push({ type: "M", x: currentX, y: currentY });
          prevCubicControlX = prevCubicControlY = null;
          prevQuadControlX = prevQuadControlY = null;
          // Subsequent coordinate pairs are treated as implicit "L".
          while (true) {
            this.skipSeparators();
            const peek = this.peekChar();
            if (peek === null || isCommandLetter(peek)) {
              break;
            }
            const point = this.readCoordinatePair();
            if (!point) {
              return segments;
            }
            currentX = isRelative ? currentX + point.x : point.x;
            currentY = isRelative ? currentY + point.y : point.y;
            segments.push({ type: "L", x: currentX, y: currentY });
          }
          break;
        }

        case "L":
        case "l": {
          const isRelative = currentCommand === "l";
          while (true) {
            const point = this.readCoordinatePair();
            if (!point) {
              break;
            }
            currentX = isRelative ? currentX + point.x : point.x;
            currentY = isRelative ? currentY + point.y : point.y;
            segments.push({ type: "L", x: currentX, y: currentY });
          }
          prevCubicControlX = prevCubicControlY = null;
          prevQuadControlX = prevQuadControlY = null;
          break;
        }

        case "H":
        case "h": {
          const isRelative = currentCommand === "h";
          while (true) {
            const value = this.readNumber();
            if (value === null) {
              break;
            }
            currentX = isRelative ? currentX + value : value;
            segments.push({ type: "L", x: currentX, y: currentY });
          }
          prevCubicControlX = prevCubicControlY = null;
          prevQuadControlX = prevQuadControlY = null;
          break;
        }

        case "V":
        case "v": {
          const isRelative = currentCommand === "v";
          while (true) {
            const value = this.readNumber();
            if (value === null) {
              break;
            }
            currentY = isRelative ? currentY + value : value;
            segments.push({ type: "L", x: currentX, y: currentY });
          }
          prevCubicControlX = prevCubicControlY = null;
          prevQuadControlX = prevQuadControlY = null;
          break;
        }

        case "C":
        case "c": {
          const isRelative = currentCommand === "c";
          while (true) {
            const first = this.readCoordinatePair();
            const second = this.readCoordinatePair();
            const end = this.readCoordinatePair();
            if (!first || !second || !end) {
              break;
            }
            const x1 = isRelative ? currentX + first.x : first.x;
            const y1 = isRelative ? currentY + first.y : first.y;
            const x2 = isRelative ? currentX + second.x : second.x;
            const y2 = isRelative ? currentY + second.y : second.y;
            currentX = isRelative ? currentX + end.x : end.x;
            currentY = isRelative ? currentY + end.y : end.y;
            segments.push({ type: "C", x1, y1, x2, y2, x: currentX, y: currentY });
            prevCubicControlX = x2;
            prevCubicControlY = y2;
            prevQuadControlX = prevQuadControlY = null;
          }
          break;
        }

        case "S":
        case "s": {
          const isRelative = currentCommand === "s";
          while (true) {
            const second = this.readCoordinatePair();
            const end = this.readCoordinatePair();
            if (!second || !end) {
              break;
            }
            let x1 = currentX;
            let y1 = currentY;
            if (prevCubicControlX !== null && prevCubicControlY !== null) {
              x1 = currentX * 2 - prevCubicControlX;
              y1 = currentY * 2 - prevCubicControlY;
            }
            const x2 = isRelative ? currentX + second.x : second.x;
            const y2 = isRelative ? currentY + second.y : second.y;
            currentX = isRelative ? currentX + end.x : end.x;
            currentY = isRelative ? currentY + end.y : end.y;
            segments.push({ type: "C", x1, y1, x2, y2, x: currentX, y: currentY });
            prevCubicControlX = x2;
            prevCubicControlY = y2;
            prevQuadControlX = prevQuadControlY = null;
          }
          break;
        }

        case "Q":
        case "q": {
          const isRelative = currentCommand === "q";
          while (true) {
            const control = this.readCoordinatePair();
            const end = this.readCoordinatePair();
            if (!control || !end) {
              break;
            }
            const cx = isRelative ? currentX + control.x : control.x;
            const cy = isRelative ? currentY + control.y : control.y;
            const ex = isRelative ? currentX + end.x : end.x;
            const ey = isRelative ? currentY + end.y : end.y;
            const cubic = quadraticToCubic(currentX, currentY, cx, cy, ex, ey);
            segments.push(cubic);
            currentX = ex;
            currentY = ey;
            prevCubicControlX = cubic.x2;
            prevCubicControlY = cubic.y2;
            prevQuadControlX = cx;
            prevQuadControlY = cy;
          }
          break;
        }

        case "T":
        case "t": {
          const isRelative = currentCommand === "t";
          while (true) {
            const end = this.readCoordinatePair();
            if (!end) {
              break;
            }
            let cx = currentX;
            let cy = currentY;
            if (prevQuadControlX !== null && prevQuadControlY !== null) {
              cx = currentX * 2 - prevQuadControlX;
              cy = currentY * 2 - prevQuadControlY;
            }
            const ex = isRelative ? currentX + end.x : end.x;
            const ey = isRelative ? currentY + end.y : end.y;
            const cubic = quadraticToCubic(currentX, currentY, cx, cy, ex, ey);
            segments.push(cubic);
            currentX = ex;
            currentY = ey;
            prevCubicControlX = cubic.x2;
            prevCubicControlY = cubic.y2;
            prevQuadControlX = cx;
            prevQuadControlY = cy;
          }
          break;
        }

        case "A":
        case "a": {
          const isRelative = currentCommand === "a";
          while (true) {
            const rx = this.readNumber();
            const ry = this.readNumber();
            const xAxisRotation = this.readNumber();
            const largeArcFlag = this.readFlag();
            const sweepFlag = this.readFlag();
            const end = this.readCoordinatePair();
            if (
              rx === null ||
              ry === null ||
              xAxisRotation === null ||
              largeArcFlag === null ||
              sweepFlag === null ||
              !end
            ) {
              break;
            }
            const ex = isRelative ? currentX + end.x : end.x;
            const ey = isRelative ? currentY + end.y : end.y;
            const curves = arcToCubicCurves(currentX, currentY, rx, ry, xAxisRotation, largeArcFlag === 1, sweepFlag === 1, ex, ey);
            if (curves.length === 0) {
              // Degenerate arc – treat as straight line.
              if (currentX !== ex || currentY !== ey) {
                segments.push({ type: "L", x: ex, y: ey });
              }
            } else {
              for (const curve of curves) {
                segments.push({
                  type: "C",
                  x1: curve[0],
                  y1: curve[1],
                  x2: curve[2],
                  y2: curve[3],
                  x: curve[4],
                  y: curve[5],
                });
              }
            }
            currentX = ex;
            currentY = ey;
            prevCubicControlX = curves.length > 0 ? curves[curves.length - 1][2] : null;
            prevCubicControlY = curves.length > 0 ? curves[curves.length - 1][3] : null;
            prevQuadControlX = prevQuadControlY = null;
          }
          break;
        }

        case "Z":
        case "z": {
          if (currentX !== startX || currentY !== startY) {
            segments.push({ type: "L", x: startX, y: startY });
          }
          segments.push({ type: "Z" });
          currentX = startX;
          currentY = startY;
          prevCubicControlX = prevCubicControlY = null;
          prevQuadControlX = prevQuadControlY = null;
          break;
        }

        default:
          // Unsupported command – abort parsing.
          return segments;
      }
    }

    return segments;
  }

  private readCoordinatePair(): { x: number; y: number } | null {
    const x = this.readNumber();
    const y = this.readNumber();
    if (x === null || y === null) {
      return null;
    }
    return { x, y };
  }

  private readFlag(): 0 | 1 | null {
    this.skipSeparators();
    if (this.isDone()) {
      return null;
    }
    const char = this.source[this.index];
    if (char === "0" || char === "1") {
      this.index += 1;
      return char === "1" ? 1 : 0;
    }
    const value = this.readNumber();
    if (value === null) {
      return null;
    }
    return value === 0 ? 0 : 1;
  }

  private readNumber(): number | null {
    this.skipSeparators();
    if (this.isDone()) {
      return null;
    }
    const slice = this.source.slice(this.index);
    const match = slice.match(/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/);
    if (!match) {
      return null;
    }
    this.index += match[0].length;
    const value = Number.parseFloat(match[0]);
    if (!Number.isFinite(value)) {
      return null;
    }
    return value;
  }

  private skipSeparators(): void {
    while (!this.isDone()) {
      const char = this.source[this.index];
      if (char === "," || char === " " || char === "\t" || char === "\n" || char === "\r") {
        this.index += 1;
        continue;
      }
      break;
    }
  }

  private peekChar(): string | null {
    if (this.isDone()) {
      return null;
    }
    return this.source[this.index];
  }

  private isDone(): boolean {
    return this.index >= this.source.length;
  }
}

function quadraticToCubic(x0: number, y0: number, cx: number, cy: number, x: number, y: number): {
  type: "C";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
} {
  const x1 = x0 + (2 / 3) * (cx - x0);
  const y1 = y0 + (2 / 3) * (cy - y0);
  const x2 = x + (2 / 3) * (cx - x);
  const y2 = y + (2 / 3) * (cy - y);
  return { type: "C", x1, y1, x2, y2, x, y };
}

function arcToCubicCurves(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  angle: number,
  largeArc: boolean,
  sweep: boolean,
  x: number,
  y: number,
): Array<[number, number, number, number, number, number]> {
  const curves: Array<[number, number, number, number, number, number]> = [];
  if (x0 === x && y0 === y) {
    return curves;
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0) {
    return curves;
  }

  const rad = (angle * Math.PI) / 180;
  const cosAngle = Math.cos(rad);
  const sinAngle = Math.sin(rad);

  const dx2 = (x0 - x) / 2;
  const dy2 = (y0 - y) / 2;
  const x1p = cosAngle * dx2 + sinAngle * dy2;
  const y1p = -sinAngle * dx2 + cosAngle * dy2;

  let rxSq = rx * rx;
  let rySq = ry * ry;
  let x1pSq = x1p * x1p;
  let y1pSq = y1p * y1p;

  let radiiCheck = x1pSq / rxSq + y1pSq / rySq;
  if (radiiCheck > 1) {
    const scale = Math.sqrt(radiiCheck);
    rx *= scale;
    ry *= scale;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  const sign = largeArc === sweep ? -1 : 1;
  const sq = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq);
  const coef = sign * Math.sqrt(Math.max(0, sq));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;

  const cx = cosAngle * cxp - sinAngle * cyp + (x0 + x) / 2;
  const cy = sinAngle * cxp + cosAngle * cyp + (y0 + y) / 2;

  const startAngle = angleBetween(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let deltaAngle = angleBetween(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );

  if (!sweep && deltaAngle > 0) {
    deltaAngle -= 2 * Math.PI;
  } else if (sweep && deltaAngle < 0) {
    deltaAngle += 2 * Math.PI;
  }

  const segments = Math.ceil(Math.abs(deltaAngle) / (Math.PI / 2));
  const delta = deltaAngle / segments;
  const t = (4 / 3) * Math.tan(delta / 4);

  let start = startAngle;
  let prevX = x0;
  let prevY = y0;

  for (let i = 0; i < segments; i += 1) {
    const end = start + delta;
    const sinStart = Math.sin(start);
    const cosStart = Math.cos(start);
    const sinEnd = Math.sin(end);
    const cosEnd = Math.cos(end);

    const x1 = cx + rx * cosAngle * cosStart - ry * sinAngle * sinStart;
    const y1 = cy + rx * sinAngle * cosStart + ry * cosAngle * sinStart;
    const x2 = cx + rx * cosAngle * cosEnd - ry * sinAngle * sinEnd;
    const y2 = cy + rx * sinAngle * cosEnd + ry * cosAngle * sinEnd;

    const dx1 = -rx * cosAngle * sinStart - ry * sinAngle * cosStart;
    const dy1 = -rx * sinAngle * sinStart + ry * cosAngle * cosStart;
    const dx2 = -rx * cosAngle * sinEnd - ry * sinAngle * cosEnd;
    const dy2 = -rx * sinAngle * sinEnd + ry * cosAngle * cosEnd;

    const cp1x = prevX + t * dx1;
    const cp1y = prevY + t * dy1;
    const cp2x = x2 - t * dx2;
    const cp2y = y2 - t * dy2;

    curves.push([cp1x, cp1y, cp2x, cp2y, x2, y2]);

    prevX = x2;
    prevY = y2;
    start = end;
  }

  return curves;
}

function angleBetween(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  const clamped = clamp(-1, 1, len === 0 ? 0 : dot / len);
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  return sign * Math.acos(clamped);
}

function isCommandLetter(char: string): boolean {
  return /[a-zA-Z]/.test(char);
}

function clamp(min: number, max: number, value: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
