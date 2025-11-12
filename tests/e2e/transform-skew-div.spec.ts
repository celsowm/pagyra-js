import { test, expect } from "vitest";
import { renderHtmlToPdf } from "../../src/html-to-pdf.js";

test("skewX transform on div with background emits PAGYRA_TRANSFORM marker in PDF", async () => {
  const html = `
    <div style="
      font-size: 32px;
      transform: skewX(20deg);
      color: white;
      background-color: #1a73e8;
      padding: 20px;
      display: inline-block;
    ">
      Content in Skewed DIV
    </div>
  `;
  const css = "";
  const pdf = await renderHtmlToPdf({
    html,
    css,
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const buf = Buffer.from(pdf);
  const marker = Buffer.from("%PAGYRA_TRANSFORM");
  const found = buf.includes(marker);
  expect(found).toBe(true);
});

test("skewX transform on div with border emits PAGYRA_TRANSFORM marker", async () => {
  const html = `
    <div style="
      font-size: 32px;
      transform: skewX(20deg);
      color: white;
      background-color: #1a73e8;
      border: 5px solid red;
      padding: 20px;
      display: inline-block;
    ">
      Conteúdo da DIV Inclinada
    </div>
  `;
  const css = "";
  const pdf = await renderHtmlToPdf({
    html,
    css,
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const buf = Buffer.from(pdf);
  const marker = Buffer.from("%PAGYRA_TRANSFORM");
  const found = buf.includes(marker);
  expect(found).toBe(true);
});

test("skewY transform on div with background", async () => {
  const html = `
    <div style="
      font-size: 24px;
      transform: skewY(15deg);
      background-color: #ff5722;
      color: white;
      padding: 15px;
      display: inline-block;
    ">
      Skewed Y Content
    </div>
  `;
  const css = "";
  const pdf = await renderHtmlToPdf({
    html,
    css,
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const buf = Buffer. from(pdf);
  const marker = Buffer.from("%PAGYRA_TRANSFORM");
  const found = buf.includes(marker);
  expect(found).toBe(true);
});

test("combined skewX and skewY transform on div", async () => {
  const html = `
    <div style="
      font-size: 28px;
      transform: skewX(10deg) skewY(10deg);
      background-color: #4caf50;
      color: white;
      border: 3px solid blue;
      padding: 18px;
      display: inline-block;
    ">
      Double Skew Transform
    </div>
  `;
  const css = "";
  const pdf = await renderHtmlToPdf({
    html,
    css,
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const buf = Buffer.from(pdf);
  const marker = Buffer.from("%PAGYRA_TRANSFORM");
  const found = buf.includes(marker);
  expect(found).toBe(true);
});

test("div without transform should not emit PAGYRA_TRANSFORM marker", async () => {
  const html = `
    <div style="
      font-size: 32px;
      color: white;
      background-color: #1a73e8;
      border: 5px solid red;
      padding: 20px;
      display: inline-block;
    ">
      Normal DIV Without Transform
    </div>
  `;
  const css = "";
  const pdf = await renderHtmlToPdf({
    html,
    css,
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const buf = Buffer.from(pdf);
  const marker = Buffer.from("%PAGYRA_TRANSFORM");
  const found = buf.includes(marker);
  expect(found).toBe(false);
});

test("multiple divs with different skew transforms", async () => {
  const html = `
    <div>
      <div style="
        font-size: 20px;
        transform: skewX(15deg);
        background-color: #e91e63;
        color: white;
        padding: 10px;
        margin: 10px;
        display: inline-block;
      ">
        Skewed X
      </div>
      <div style="
        font-size: 20px;
        transform: skewY(-10deg);
        background-color: #9c27b0;
        color: white;
        padding: 10px;
        margin: 10px;
        display: inline-block;
      ">
        Skewed Y
      </div>
    </div>
  `;
  const css = "";
  const pdf = await renderHtmlToPdf({
    html,
    css,
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const buf = Buffer.from(pdf);
  const marker = Buffer.from("%PAGYRA_TRANSFORM");
  // Should find at least one transform marker
  const found = buf.includes(marker);
  expect(found).toBe(true);
  
  // Count occurrences - should have 2 (one for each div)
  const pdfStr = buf.toString('latin1');
  const matches = pdfStr.match(/%PAGYRA_TRANSFORM/g);
  expect(matches).toBeTruthy();
  expect(matches!.length).toBeGreaterThanOrEqual(2);
});
