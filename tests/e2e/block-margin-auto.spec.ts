import { expect, test } from "vitest";
import { prepareHtmlRender } from "../../src/html-to-pdf.js";
import type { RenderBox } from "../../src/pdf/types.js";

function findBoxWithParent(
  box: RenderBox,
  predicate: (box: RenderBox) => boolean,
  parent: RenderBox | null = null,
): { box: RenderBox; parent: RenderBox } | null {
  if (predicate(box)) {
    return parent ? { box, parent } : null;
  }
  for (const child of box.children) {
    const result = findBoxWithParent(child, predicate, box);
    if (result) {
      return result;
    }
  }
  return null;
}

test("block with width and horizontal auto margins centers inside its containing block", async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          html, body { margin: 0; padding: 0; }
          .caixa {
            border: 2px dashed #333;
            padding: 16px;
            width: 200px;
            margin: 40px auto;
            text-align: center;
            font-family: Arial, sans-serif;
          }
        </style>
      </head>
      <body>
        <div class="caixa">Borda tracejada :)</div>
      </body>
    </html>
  `;

  const prepared = await prepareHtmlRender({
    html,
    css: "",
    viewportWidth: 500,
    viewportHeight: 600,
    pageWidth: 500,
    pageHeight: 700,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const match = findBoxWithParent(prepared.renderTree.root, (box) => box.tagName === "div");
  expect(match).not.toBeNull();
  if (!match) {
    return;
  }

  const { box, parent } = match;
  const parentContentStartX = parent.contentBox.x;
  const parentContentWidth = parent.contentBox.width;

  const paddingLeft = box.padding.left ?? 0;
  const borderLeft = box.border.left ?? 0;
  const marginLeftUsed = box.contentBox.x - parentContentStartX - paddingLeft - borderLeft;
  const expectedMargin = (parentContentWidth - box.borderBox.width) / 2;

  expect(marginLeftUsed).toBeCloseTo(expectedMargin, 3);
  const marginRightUsed = parentContentWidth - (box.borderBox.width + marginLeftUsed);
  expect(marginRightUsed).toBeCloseTo(expectedMargin, 3);
});
