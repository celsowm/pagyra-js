import { expect, test } from "vitest";
import { prepareHtmlRender } from "../../src/html-to-pdf.js";
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
