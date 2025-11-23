export function extractPdfContent(pdfBuffer: Buffer): string {
  const pdfStr = pdfBuffer.toString("latin1");

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const matches: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(pdfStr)) !== null) {
    matches.push(match[1]);
  }

  if (matches.length === 0) {
    // Fallback: inspect whole PDF to avoid brittle filtering
    return pdfStr;
  }

  return matches.join("\n");
}

export function extractTransformMatrix(
  content: string
): Array<{ a: number; b: number; c: number; d: number; e: number; f: number }> {
  const matrices: Array<{
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
  }> = [];

  const matrixRegex =
    /([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+cm/g;

  let match: RegExpExecArray | null;
  while ((match = matrixRegex.exec(content)) !== null) {
    matrices.push({
      a: parseFloat(match[1]),
      b: parseFloat(match[2]),
      c: parseFloat(match[3]),
      d: parseFloat(match[4]),
      e: parseFloat(match[5]),
      f: parseFloat(match[6]),
    });
  }

  return matrices;
}

export function extractRectangles(
  content: string
): Array<{ x: number; y: number; width: number; height: number }> {
  const rectangles: Array<{ x: number; y: number; width: number; height: number }> = [];

  const rectRegex = /([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+re/g;

  let match: RegExpExecArray | null;
  while ((match = rectRegex.exec(content)) !== null) {
    rectangles.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      width: parseFloat(match[3]),
      height: parseFloat(match[4]),
    });
  }

  return rectangles;
}

export function extractPagyraTransformComments(
  content: string
): Array<{ a: number; b: number; c: number; d: number; e: number; f: number }> {
  const matches: Array<{ a: number; b: number; c: number; d: number; e: number; f: number }> = [];
  const regex = /%PAGYRA_TRANSFORM\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    matches.push({
      a: parseFloat(match[1]),
      b: parseFloat(match[2]),
      c: parseFloat(match[3]),
      d: parseFloat(match[4]),
      e: parseFloat(match[5]),
      f: parseFloat(match[6]),
    });
  }
  return matches;
}

export function approxEqual(a: number, b: number, epsilon: number = 0.01): boolean {
  return Math.abs(a - b) < epsilon;
}
