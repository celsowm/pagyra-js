import { expect, test } from "vitest";
import { prepareHtmlRender, renderHtmlToPdf } from "../../src/html-to-pdf.js";
import type { RenderBox } from "../../src/pdf/types.js";

function collectListItemBoxes(box: RenderBox, acc: RenderBox[] = []): RenderBox[] {
  if (box.tagName === "li") {
    acc.push(box);
  }
  for (const child of box.children) {
    collectListItemBoxes(child, acc);
  }
  return acc;
}

test("list-style-type declarations propagate to PDF text runs", async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          ul.square {
            list-style-type: square;
          }
          ol.alpha {
            list-style-type: upper-alpha;
          }
          ul.none li {
            list-style-type: none;
          }
        </style>
      </head>
      <body>
        <ul class="square"><li>Square One</li></ul>
        <ol class="alpha"><li>Alpha One</li></ol>
        <ul class="none"><li>No Marker</li></ul>
      </body>
    </html>
  `;

  const prepared = await prepareHtmlRender({
    html,
    css: "",
    viewportWidth: 600,
    viewportHeight: 800,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const listBoxes = collectListItemBoxes(prepared.renderTree.root);
  expect(listBoxes.length).toBeGreaterThanOrEqual(3);

  const [squareBox, alphaBox, noneBox] = listBoxes;
  expect(squareBox.textRuns[0]?.text).toBe("\u25AA");
  expect(alphaBox.textRuns[0]?.text).toBe("A.");
  expect(noneBox.textRuns.length).toBe(0);
});

function extractPdfContent(pdfBuffer: Buffer): string {
  const pdfStr = pdfBuffer.toString("latin1");
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(pdfStr)) !== null) {
    const startIndex = match.index ?? 0;
    const prefix = pdfStr.slice(Math.max(0, startIndex - 200), startIndex);
    if (/FontFile/i.test(prefix) || /CIDFont/i.test(prefix) || /ToUnicode/i.test(prefix)) {
      continue;
    }
    matches.push(match[1]);
  }
  if (matches.length === 0) {
    throw new Error("No content streams found in rendered PDF");
  }
  return matches.join("\n");
}

test("rendered PDF encodes list markers using Unicode bullets", async () => {
  const html = `
    <main>
      <section>
        <h2>Square Bullets</h2>
        <ul style="list-style-type: square">
          <li>Square marker one</li>
          <li>Square marker two</li>
          <li>Square marker three</li>
        </ul>
      </section>
      <section>
        <h2>Circle Bullets</h2>
        <ul style="list-style-type: circle">
          <li>Circle marker one</li>
          <li>Circle marker two</li>
          <li>Circle marker three</li>
        </ul>
      </section>
      <section>
        <h2>Disc Bullets</h2>
        <ul style="list-style-type: disc">
          <li>Disc marker one</li>
          <li>Disc marker two</li>
          <li>Disc marker three</li>
        </ul>
      </section>
    </main>
  `;

  const pdf = await renderHtmlToPdf({
    html,
    css: "",
    viewportWidth: 800,
    viewportHeight: 1200,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
  });

  const pdfBuffer = Buffer.from(pdf);
  const content = extractPdfContent(pdfBuffer);
  const latin1 = pdfBuffer.toString("latin1");

  expect(latin1).toContain("/Type /Font");

  expect(content).not.toContain("(\u0000\u0000) Tj");
});
