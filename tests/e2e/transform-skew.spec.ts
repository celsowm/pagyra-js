import { test, expect } from "vitest";
import { renderHtmlToPdf } from "../../src/html-to-pdf.js";

/**
 * Helper to extract all PDF content streams from a PDF buffer
 */
function extractPdfContent(pdfBuffer: Buffer): string {
  const pdfStr = pdfBuffer.toString("latin1");

  // Capture all "stream ... endstream" blocks
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const matches: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(pdfStr)) !== null) {
    matches.push(match[1]);
  }

  if (matches.length === 0) {
    throw new Error("Could not find any PDF content streams");
  }

  // Concatenate all content streams – good enough for tests that just scan operators.
  return matches.join("\n");
}

/**
 * Helper to parse transformation matrix from PDF content
 * Looks for patterns like: "a b c d e f cm"
 */
function extractTransformMatrix(
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

  // Match matrix pattern: "a b c d e f cm"
  // (does not handle scientific notation; fine for these tests)
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

/**
 * Helper to extract rectangle drawing operations
 * Looks for patterns like: "x y width height re"
 */
function extractRectangles(
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

function extractPagyraTransformComments(
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

/**
 * Helper to check if two numbers are approximately equal
 */
function approxEqual(a: number, b: number, epsilon: number = 0.01): boolean {
  return Math.abs(a - b) < epsilon;
}

/**
 * --- Tests ---
 */

test("skewX(20deg) should produce correct transformation matrix in PDF", async () => {
  const html = `
    <div style="
      width: 100px;
      height: 50px;
      transform: skewX(20deg);
      background-color: #1a73e8;
      position: absolute;
      top: 0;
      left: 0;
    ">
      Test
    </div>
  `;

  const pdf = await renderHtmlToPdf({
    html,
    css: "",
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const content = extractPdfContent(Buffer.from(pdf));
  const matrices = extractTransformMatrix(content);

  // CSS skewX(20deg) matrix: [1, 0, tan(20°), 1, tx, ty]
  const expectedC = Math.tan((20 * Math.PI) / 180); // ≈ 0.364

  const skewMatrix = matrices.find(
    (m) =>
      approxEqual(m.a, 1, 0.2) && // allow for px→pt scaling, etc.
      approxEqual(m.d, 1, 0.2) &&
      approxEqual(m.b, 0, 0.1) &&
      approxEqual(m.c, expectedC, 0.05)
  );

  expect(skewMatrix).toBeDefined();
  if (skewMatrix) {
    expect(skewMatrix.a).toBeCloseTo(1, 2);
    expect(skewMatrix.b).toBeCloseTo(0, 3);
    expect(skewMatrix.c).toBeCloseTo(expectedC, 2);
    expect(skewMatrix.d).toBeCloseTo(1, 2);
  }
});

test("skewY(15deg) should produce correct transformation matrix in PDF", async () => {
  const html = `
    <div style="
      width: 100px;
      height: 50px;
      transform: skewY(15deg);
      background-color: #ff5722;
      position: absolute;
      top: 0;
      left: 0;
    ">
      Test
    </div>
  `;

  const pdf = await renderHtmlToPdf({
    html,
    css: "",
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const content = extractPdfContent(Buffer.from(pdf));
  const matrices = extractTransformMatrix(content);

  // CSS skewY(15deg) matrix: [1, tan(15°), 0, 1, tx, ty]
  const expectedB = Math.tan((15 * Math.PI) / 180); // ≈ 0.268

  const skewMatrix = matrices.find(
    (m) =>
      approxEqual(m.a, 1, 0.2) &&
      approxEqual(m.d, 1, 0.2) &&
      approxEqual(m.c, 0, 0.1) &&
      approxEqual(m.b, expectedB, 0.05)
  );

  expect(skewMatrix).toBeDefined();
  if (skewMatrix) {
    expect(skewMatrix.a).toBeCloseTo(1, 2);
    expect(skewMatrix.b).toBeCloseTo(expectedB, 2);
    expect(skewMatrix.c).toBeCloseTo(0, 3);
    expect(skewMatrix.d).toBeCloseTo(1, 2);
  }
});

test("skewX(20deg) skewY(10deg) combined transform should produce non-zero b and c with correct magnitudes", async () => {
  const html = `
    <div style="
      width: 100px;
      height: 50px;
      transform: skewX(20deg) skewY(10deg);
      background-color: #4caf50;
      position: absolute;
      top: 0;
      left: 0;
    ">
      Test
    </div>
  `;

  const pdf = await renderHtmlToPdf({
    html,
    css: "",
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const content = extractPdfContent(Buffer.from(pdf));
  const matrices = extractTransformMatrix(content);

  const tanX = Math.tan((20 * Math.PI) / 180); // ≈ 0.364
  const tanY = Math.tan((10 * Math.PI) / 180); // ≈ 0.176

  // Aqui não dependemos da ordem exata da multiplicação, só de que
  // o resultado tenha componentes b e c com magnitudes compatíveis.
  const skewMatrix = matrices.find(
    (m) =>
      approxEqual(m.a, 1, 0.3) &&
      approxEqual(m.d, 1, 0.3) &&
      Math.abs(m.c) > 0.01 &&
      Math.abs(m.b) > 0.01 &&
      approxEqual(Math.abs(m.c), Math.abs(tanX), 0.15) &&
      approxEqual(Math.abs(m.b), Math.abs(tanY), 0.15)
  );

  expect(skewMatrix).toBeDefined();
  if (skewMatrix) {
    expect(Math.abs(skewMatrix.c)).toBeCloseTo(Math.abs(tanX), 1);
    expect(Math.abs(skewMatrix.b)).toBeCloseTo(Math.abs(tanY), 1);
  }
});

test("rectangle should be drawn at origin (0,0) within transform context", async () => {
  const html = `
    <div style="
      width: 100px;
      height: 50px;
      transform: skewX(20deg);
      background-color: #1a73e8;
      position: absolute;
      top: 100px;
      left: 50px;
    ">
    </div>
  `;

  const pdf = await renderHtmlToPdf({
    html,
    css: "",
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const content = extractPdfContent(Buffer.from(pdf));
  const rectangles = extractRectangles(content);

  // Com transform aplicado, o shape de fundo deve ser emitido relativo à origem
  const originRect = rectangles.find(
    (r) =>
      Math.abs(r.x) < 5 &&
      Math.abs(r.y) < 5 &&
      r.width > 0 &&
      r.height > 0
  );

  expect(originRect).toBeDefined();
  if (originRect) {
    expect(Math.abs(originRect.x)).toBeLessThan(5);
    expect(Math.abs(originRect.y)).toBeLessThan(5);
  }
});

test("negative skew angle should produce negative tan value in matrix", async () => {
  const html = `
    <div style="
      width: 100px;
      height: 50px;
      transform: skewX(-15deg);
      background-color: #9c27b0;
      position: absolute;
      top: 0;
      left: 0;
    ">
      Test
    </div>
  `;

  const pdf = await renderHtmlToPdf({
    html,
    css: "",
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const content = extractPdfContent(Buffer.from(pdf));
  const matrices = extractTransformMatrix(content);

  const expectedC = Math.tan((-15 * Math.PI) / 180); // ≈ -0.268

  const skewMatrix = matrices.find(
    (m) =>
      approxEqual(m.a, 1, 0.2) &&
      approxEqual(m.d, 1, 0.2) &&
      approxEqual(m.b, 0, 0.1) &&
      approxEqual(m.c, expectedC, 0.05)
  );

  expect(skewMatrix).toBeDefined();
  if (skewMatrix) {
    expect(skewMatrix.c).toBeCloseTo(expectedC, 2);
    expect(skewMatrix.c).toBeLessThan(0); // deve ser negativo para skewX(-15deg)
  }
});

test("PDF should contain graphics state save (q) before and restore (Q) after transform", async () => {
  const html = `
    <div style="
      width: 100px;
      height: 50px;
      transform: skewX(20deg);
      background-color: #1a73e8;
    ">
      Test
    </div>
  `;

  const pdf = await renderHtmlToPdf({
    html,
    css: "",
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const content = extractPdfContent(Buffer.from(pdf));

  // Conta "q" e "Q" como operadores isolados (delimitados por espaço ou início/fim de linha)
  const qMatches = content.match(/(^|\s)q(\s|$)/g) || [];
  const QMatches = content.match(/(^|\s)Q(\s|$)/g) || [];

  const qCount = qMatches.length;
  const QCount = QMatches.length;

  // Deve haver pelo menos um par q/Q associado ao transform
  expect(qCount).toBeGreaterThan(0);
  expect(QCount).toBeGreaterThan(0);
  // q e Q devem estar balanceados
  expect(qCount).toBe(QCount);
});

test("skewed text runs use local coordinates independent of page offset", async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
          }
          .box {
            width: 200px;
            height: 100px;
            margin: 40px 0;
            background: #4a90e2;
            color: red;
            display: flex;
            align-items: center;
            justify-content: center;
            transform: skewX(20deg);
          }
          .offset {
            margin-top: 200px;
          }
        </style>
      </head>
      <body>
        <div class="box">Skew</div>
        <div class="box offset">Skew</div>
      </body>
    </html>
  `;

  const pdf = await renderHtmlToPdf({
    html,
    css: "",
    viewportWidth: 800,
    viewportHeight: 1200,
    pageWidth: 595,
    pageHeight: 1000,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const content = extractPdfContent(Buffer.from(pdf));
  const transforms = extractPagyraTransformComments(content).filter(
    (m) => Math.abs(m.f) > 0.01 && Math.abs(m.c) > 0.001
  );

  expect(transforms.length).toBeGreaterThanOrEqual(2);
  const sorted = transforms.sort((a, b) => a.f - b.f);
  const first = sorted[0];
  const second = sorted[1];

  expect(Math.abs(first.e - second.e)).toBeLessThan(0.5);
  expect(Math.sign(first.c)).toEqual(Math.sign(second.c));
});
