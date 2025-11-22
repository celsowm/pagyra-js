import { expect, test } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderHtmlToPdf } from "../../src/index.js";
import { PDFParse } from "pdf-parse";

test("downloads and embeds remote WOFF2 fonts referenced via stylesheet", async () => {
  const fontBuffer = await readFile(path.resolve("./assets/fonts/woff2/caveat/Caveat-Regular.woff2"));
  const requests: string[] = [];

  let fontCss = "";
  const server = createServer((req, res) => {
    if (req.url) requests.push(req.url);

    if (req.url === "/fonts.css") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/css");
      res.end(fontCss);
      return;
    }

    if (req.url === "/Caveat-Regular.woff2") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "font/woff2");
      res.end(fontBuffer);
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  fontCss = `
    @font-face {
      font-family: 'Caveat';
      src: url('http://127.0.0.1:${port}/Caveat-Regular.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
    }
    body { font-family: 'Caveat', serif; }
  `;

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Remote Font Demo</title>
  <link rel="stylesheet" href="http://127.0.0.1:${port}/fonts.css">
</head>
<body>
  <span style="display: block; font-family: 'Caveat', serif; font-weight: 400; font-style: normal;">
    Remote Caveat: The quick brown fox jumps over the lazy dog.
  </span>
</body>
</html>`;

  try {
    const pdfBuffer = await renderHtmlToPdf({
      html,
      css: "",
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 800,
      pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const pdfBinary = Buffer.from(pdfBuffer);
    expect(pdfBinary.toString("latin1")).toContain("Caveat");

    const parsed = await new PDFParse({ data: pdfBinary }).getText();
    expect(parsed.text).toContain("Remote Caveat: The quick brown fox jumps over the lazy dog");
    expect(requests).toContain("/fonts.css");
    expect(requests).toContain("/Caveat-Regular.woff2");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
