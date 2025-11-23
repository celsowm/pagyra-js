import { expect, test } from "vitest";
import { prepareHtmlRender } from "../../src/html-to-pdf.js";
import type { RenderBox } from "../../src/pdf/types.js";

function collectText(box: RenderBox): string {
  const selfText = box.textRuns.map((run) => run.text).join("");
  return box.children.reduce((acc, child) => acc + collectText(child), selfText);
}

function findBox(root: RenderBox, predicate: (box: RenderBox) => boolean): RenderBox | null {
  if (predicate(root)) return root;
  for (const child of root.children) {
    const match = findBox(child, predicate);
    if (match) {
      return match;
    }
  }
  return null;
}

function findCellByText(root: RenderBox, tagName: string, needle: string): RenderBox {
  const lowerNeedle = needle.toLowerCase();
  const match = findBox(root, (box) => {
    if ((box.tagName ?? "").toLowerCase() !== tagName.toLowerCase()) return false;
    return collectText(box).toLowerCase().includes(lowerNeedle);
  });
  if (!match) {
    throw new Error(`Cell with text "${needle}" not found`);
  }
  return match;
}

function findTextBox(root: RenderBox, needle: string): RenderBox {
  const lowerNeedle = needle.toLowerCase();
  const match = findBox(root, (box) => {
    return (box.textContent ?? "").toLowerCase().includes(lowerNeedle);
  });
  if (!match) {
    throw new Error(`Text box with text "${needle}" not found`);
  }
  return match;
}

test("table layout honours colspan and rowspan", async () => {
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Tabela com mescla</title>
        <style>
          table {
            border-collapse: collapse;
            width: 300px;
          }
          td,
          th {
            border: 1px solid #333;
            padding: 8px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <th colspan="2">Cabeçalho mesclado</th>
          </tr>
          <tr>
            <td rowspan="2">Mescla vertical</td>
            <td>Linha 1</td>
          </tr>
          <tr>
            <td>Linha 2</td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const prepared = await prepareHtmlRender({
    html,
    css: "",
    viewportWidth: 600,
    viewportHeight: 800,
    pageWidth: 600,
    pageHeight: 800,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const header = findCellByText(prepared.renderTree.root, "th", "Cabeçalho");
  const vertical = findCellByText(prepared.renderTree.root, "td", "Mescla vertical");
  const line1 = findCellByText(prepared.renderTree.root, "td", "Linha 1");
  const line2 = findCellByText(prepared.renderTree.root, "td", "Linha 2");

  const combinedWidth = vertical.borderBox.width + line1.borderBox.width;
  expect(header.borderBox.width).toBeCloseTo(combinedWidth, 1);

  const combinedHeight = line1.borderBox.height + line2.borderBox.height;
  expect(vertical.borderBox.height).toBeCloseTo(combinedHeight, 1);

  expect(vertical.borderBox.x).toBeCloseTo(header.borderBox.x, 1);
  expect(line1.borderBox.x).toBeGreaterThan(vertical.borderBox.x);

  // We do not currently enforce perfect vertical centering of the text
  // within a rowspan cell, but the cell spanning geometry must hold.
});
