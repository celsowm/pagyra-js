import { expect, test } from "vitest";
import { prepareHtmlRender } from "../../src/html-to-pdf.js";
import type { RenderBox, Run } from "../../src/pdf/types.js";

function collectRuns(box: RenderBox): Run[] {
  const runs: Run[] = [...box.textRuns];
  for (const child of box.children) {
    runs.push(...collectRuns(child));
  }
  return runs;
}

test("justified paragraphs distribute slack across fragmented inline content", async () => {
  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
          }
          p {
            width: 360px;
            font-size: 16px;
            line-height: 24px;
            text-align: justify;
          }
          strong {
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <p>
          This paragraph mixes <strong>inline formatting</strong> with regular text so that
          justification still spreads the remaining space across each line instead of
          leaving the words clustered on the left.
        </p>
      </body>
    </html>
  `;

  const { renderTree } = await prepareHtmlRender({
    html,
    css: "",
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const runs = collectRuns(renderTree.root).filter((run) => run.text.trim().length > 0 || run.text.includes(" "));
  expect(runs.length).toBeGreaterThan(1);

  const lines = new Map<number, Run[]>();
  for (const run of runs) {
    const baseline = run.lineMatrix.f;
    const existing = lines.get(baseline) ?? [];
    existing.push(run);
    lines.set(baseline, existing);
  }

  const baselines = Array.from(lines.keys()).sort((a, b) => a - b);
  expect(baselines.length).toBeGreaterThan(1);

  const firstLine = lines.get(baselines[0]) ?? [];
  const lastLine = lines.get(baselines[baselines.length - 1]) ?? [];

  expect(firstLine.some((run) => (run.wordSpacing ?? 0) > 0)).toBe(true);
  expect(lastLine.every((run) => (run.wordSpacing ?? 0) === 0)).toBe(true);
});
