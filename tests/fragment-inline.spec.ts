import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import type { RenderBox, Run } from "../src/pdf/types.js";

function collectRuns(box: RenderBox): Run[] {
  const runs: Run[] = [...box.textRuns];
  for (const child of box.children) {
    runs.push(...collectRuns(child));
  }
  return runs;
}

describe("inline fragment rendering", () => {
  it("lays out text from an inline root fragment without stacking glyphs", async () => {
    const { renderTree } = await prepareHtmlRender({
      html: "<em>it&aacute;lico</em>",
      css: "",
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 800,
      pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const runs = collectRuns(renderTree.root).filter((run) => run.text.length > 0);
    expect(runs.map((run) => run.text)).toEqual(["it", "\u00e1", "lico"]);

    const xPositions = runs.map((run) => run.lineMatrix?.e ?? 0);
    expect(xPositions[1]).toBeGreaterThan(xPositions[0]);
    expect(xPositions[2]).toBeGreaterThan(xPositions[1]);
  });
});
