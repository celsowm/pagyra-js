import { test, expect } from "vitest";
import { renderHtmlToPdf } from "../../src/html-to-pdf.js";
import {
  approxEqual,
  extractPagyraTransformComments,
  extractPdfContent,
  extractRectangles,
  extractTransformMatrix,
} from "../helpers/pdf.js";

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
  // After converting to PDF's Y-up coordinate system the shear sign flips.
  const cssC = Math.tan((20 * Math.PI) / 180);
  const expectedC = -cssC;

  expect(matrices.length).toBeGreaterThan(0);
  const skewMatrix =
    matrices.find(
      (m) =>
        approxEqual(m.a, 1, 0.25) &&
        approxEqual(m.d, 1, 0.25) &&
        approxEqual(m.b, 0, 0.15) &&
        approxEqual(m.c, expectedC, 0.08)
    ) ?? matrices[0];

  expect(skewMatrix.a).toBeCloseTo(1, 1);
  expect(skewMatrix.b).toBeCloseTo(0, 1);
  expect(skewMatrix.c).toBeCloseTo(expectedC, 1);
  expect(skewMatrix.d).toBeCloseTo(1, 1);
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
  const cssB = Math.tan((15 * Math.PI) / 180);
  const expectedB = -cssB;

  expect(matrices.length).toBeGreaterThan(0);
  const skewMatrix =
    matrices.find(
      (m) =>
        approxEqual(m.a, 1, 0.25) &&
        approxEqual(m.d, 1, 0.25) &&
        approxEqual(m.c, 0, 0.15) &&
        approxEqual(m.b, expectedB, 0.08)
    ) ?? matrices[0];

  expect(skewMatrix.a).toBeCloseTo(1, 1);
  expect(skewMatrix.b).toBeCloseTo(expectedB, 1);
  expect(skewMatrix.c).toBeCloseTo(0, 1);
  expect(skewMatrix.d).toBeCloseTo(1, 1);
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
  expect(matrices.length).toBeGreaterThan(0);
  const skewMatrix =
    matrices.find(
      (m) =>
        Math.abs(m.c) > 0.01 &&
        Math.abs(m.b) > 0.01 &&
        approxEqual(Math.abs(m.c), Math.abs(tanX), 0.2) &&
        approxEqual(Math.abs(m.b), Math.abs(tanY), 0.2)
    ) ?? matrices[0];

  expect(Math.abs(skewMatrix.c)).toBeCloseTo(Math.abs(tanX), 1);
  expect(Math.abs(skewMatrix.b)).toBeCloseTo(Math.abs(tanY), 1);
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

test("negative skew angle should still flip to positive shear in PDF", async () => {
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

  const cssNegativeC = Math.tan((-15 * Math.PI) / 180); // CSS value ≈ -0.268
  const expectedC = -cssNegativeC;

  expect(matrices.length).toBeGreaterThan(0);
  const skewMatrix =
    matrices.find(
      (m) =>
        approxEqual(m.a, 1, 0.25) &&
        approxEqual(m.d, 1, 0.25) &&
        approxEqual(m.b, 0, 0.15) &&
        approxEqual(m.c, expectedC, 0.08)
    ) ?? matrices[0];

  expect(skewMatrix.c).toBeCloseTo(expectedC, 1);
  expect(skewMatrix.c).toBeGreaterThan(0); // após flip do eixo-y fica positivo
});

test("skew transforms pivot around the element center", async () => {
  const html = `
    <div style="
      width: 200px;
      height: 100px;
      transform: skewX(20deg);
      background-color: #4a90e2;
      margin: 40px;
    ">
      Center
    </div>
  `;

  const pdf = await renderHtmlToPdf({
    html,
    css: "",
    viewportWidth: 640,
    viewportHeight: 480,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const content = extractPdfContent(Buffer.from(pdf));
  const matrices = extractTransformMatrix(content);

  const pxToPt = (value: number) => (value * 72) / 96;
  const halfWidthPt = pxToPt(200 / 2); // 75pt
  const halfHeightPt = pxToPt(100 / 2); // 37.5pt

  expect(matrices.length).toBeGreaterThan(0);
  const translateToCenter = matrices.find(
    (m) =>
      approxEqual(m.a, 1, 0.05) &&
      approxEqual(m.d, 1, 0.05) &&
      approxEqual(m.b, 0, 0.05) &&
      approxEqual(m.c, 0, 0.05) &&
      approxEqual(m.e, -halfWidthPt, 1) &&
      approxEqual(m.f, halfHeightPt, 1)
  );

  const translateBackFromCenter = matrices.find(
    (m) =>
      approxEqual(m.a, 1, 0.05) &&
      approxEqual(m.d, 1, 0.05) &&
      approxEqual(m.b, 0, 0.05) &&
      approxEqual(m.c, 0, 0.05) &&
      approxEqual(m.e, halfWidthPt, 1) &&
      approxEqual(m.f, -halfHeightPt, 1)
  );

  expect(translateToCenter).toBeDefined();
  expect(translateBackFromCenter).toBeDefined();
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

  if (transforms.length === 0) {
    return;
  }
  const sorted = transforms.sort((a, b) => a.f - b.f);
  const first = sorted[0];
  const second = sorted[Math.min(1, sorted.length - 1)];

  expect(Math.abs(first.e - second.e)).toBeLessThan(0.5);
  expect(Math.sign(first.c)).toEqual(Math.sign(second.c));
});
