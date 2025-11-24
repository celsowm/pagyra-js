import { describe, it, expect } from "vitest";
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
});
