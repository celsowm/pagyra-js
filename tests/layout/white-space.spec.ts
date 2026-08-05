import { collectRuns, renderTreeForHtml } from "../helpers/render-utils.js";

function lineIndexesForTextRuns(renderTree: Awaited<ReturnType<typeof renderTreeForHtml>>): number[] {
  return collectRuns(renderTree.root)
    .filter((run) => run.text.length > 0 && typeof run.lineIndex === "number")
    .map((run) => run.lineIndex as number);
}

describe("white-space inline layout", () => {
  it("wraps normal text when the content width is constrained", async () => {
    const renderTree = await renderTreeForHtml(
      '<p style="width: 70px; font-size: 16px; white-space: normal">alpha beta gamma delta</p>',
    );

    const lineIndexes = lineIndexesForTextRuns(renderTree);

    expect(new Set(lineIndexes).size).toBeGreaterThan(1);
  });

  it("keeps nowrap text on one line even when it overflows", async () => {
    const renderTree = await renderTreeForHtml(
      '<p style="width: 70px; font-size: 16px; white-space: nowrap">alpha beta gamma delta</p>',
    );

    const lineIndexes = lineIndexesForTextRuns(renderTree);

    expect(new Set(lineIndexes)).toEqual(new Set([0]));
  });

  it("keeps pre text on one line unless there is an explicit newline", async () => {
    const renderTree = await renderTreeForHtml(
      '<div style="width: 40px; font-size: 16px; white-space: pre">alpha beta\ngamma delta</div>',
    );

    const lineIndexes = lineIndexesForTextRuns(renderTree);

    expect(new Set(lineIndexes)).toEqual(new Set([0, 1]));
  });

  it("allows pre-wrap text to wrap while preserving explicit newlines", async () => {
    const renderTree = await renderTreeForHtml(
      '<div style="width: 55px; font-size: 16px; white-space: pre-wrap">alpha beta\ngamma delta</div>',
    );

    const lineIndexes = lineIndexesForTextRuns(renderTree);

    expect(new Set(lineIndexes).size).toBeGreaterThan(2);
  });
});
