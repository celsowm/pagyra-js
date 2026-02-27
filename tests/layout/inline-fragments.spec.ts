import { renderTreeForHtml, collectRuns } from "../helpers/render-utils.js";

describe("inline fragment layout", () => {
    it("lays out inline fragments without stacking glyphs", async () => {
        const renderTree = await renderTreeForHtml("<em>itálico</em>");
        const runs = collectRuns(renderTree.root).filter((r) => r.text.length > 0);

        const xPositions = runs.map((r) => r.lineMatrix?.e ?? 0);
        for (let i = 1; i < xPositions.length; i++) {
            expect(xPositions[i]).toBeGreaterThan(xPositions[i - 1]);
        }
    });

    it("keeps justified inline fragments in increasing x order", async () => {
        const html =
            '<p style="text-align: justify; width: 200px">normal <b>bold</b> normal</p>';
        const renderTree = await renderTreeForHtml(html);
        const runs = collectRuns(renderTree.root).filter((r) => r.text.length > 0);

        const xPositions = runs.map((r) => r.lineMatrix?.e ?? 0);
        for (let i = 1; i < xPositions.length; i++) {
            expect(xPositions[i]).toBeGreaterThan(xPositions[i - 1]);
        }
    });

    it("does not emit leading or trailing whitespace-only runs in justified paragraph lines", async () => {
        const html = `
      <p style="text-align: justify; width: 220px;">
        This short sample demonstrates how justified paragraphs spread the remaining space
        across each line and keeps line edges aligned.
      </p>
    `;
        const renderTree = await renderTreeForHtml(html, "", { pagedBodyMargin: "zero" });
        const runs = collectRuns(renderTree.root).filter((r) => typeof r.lineIndex === "number");

        const byLine = new Map<number, typeof runs>();
        for (const run of runs) {
            const idx = run.lineIndex as number;
            const lineRuns = byLine.get(idx) ?? [];
            lineRuns.push(run);
            byLine.set(idx, lineRuns);
        }

        const lineIndexes = [...byLine.keys()].sort((a, b) => a - b);
        const firstLineRuns = [...(byLine.get(lineIndexes[0]) ?? [])].sort((a, b) => (a.lineMatrix?.e ?? 0) - (b.lineMatrix?.e ?? 0));
        const lastLineRuns = [...(byLine.get(lineIndexes[lineIndexes.length - 1]) ?? [])].sort((a, b) => (a.lineMatrix?.e ?? 0) - (b.lineMatrix?.e ?? 0));

        expect(firstLineRuns[0].text.trim().length).toBeGreaterThan(0);
        expect(lastLineRuns[lastLineRuns.length - 1].text.trim().length).toBeGreaterThan(0);
    });

    it("inherits font size and baseline for strong/em/a from parent text", async () => {
        const html = '<p style="font-size: 20px; line-height: 1.5;">base <strong>forte</strong> <em>italico</em> <a href="https://pagyra.dev">link</a></p>';
        const renderTree = await renderTreeForHtml(html);
        const runs = collectRuns(renderTree.root).filter((r) =>
            ["base", "forte", "italico", "link"].includes(r.text),
        );

        expect(runs).toHaveLength(4);

        const baseRun = runs.find((r) => r.text === "base");
        expect(baseRun).toBeDefined();

        const baseFontSize = baseRun?.fontSize ?? 0;
        const baseBaseline = baseRun?.lineMatrix?.f ?? 0;

        for (const text of ["forte", "italico", "link"]) {
            const run = runs.find((r) => r.text === text);
            expect(run).toBeDefined();
            expect(run?.fontSize).toBeCloseTo(baseFontSize, 4);
            expect(run?.lineMatrix?.f).toBeCloseTo(baseBaseline, 4);
        }
    });
});
