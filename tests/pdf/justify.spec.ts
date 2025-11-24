import { describe, it, expect } from "vitest";
import { renderRuns, renderTreeForHtml } from "../helpers/render-utils.js";
import { computeLineMetrics } from "../helpers/text-geometry.js";

describe("PDF text justification", () => {
    it("fully justifies non-final lines and leaves the last line ragged-right", async () => {
        const html = `
      <div style="width: 360px; font-size: 16px; text-align: justify;">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent viverra
        augue quis libero tincidunt, ac condimentum sapien faucibus. Fusce finibus
        odio nisi, vitae laoreet metus convallis ut. Integer consequat magna sed
        turpis efficitur, eget dignissim augue interdum.
      </div>
    `;

        const renderTree = await renderTreeForHtml(html);
        const root = renderTree.root;
        const paragraphBox = root.children[0];

        const lines = computeLineMetrics(paragraphBox);
        const X_L = paragraphBox.contentBox.x;
        const X_R = paragraphBox.contentBox.x + paragraphBox.contentBox.width;
        const epsilon = 1; // px tolerance

        lines.forEach((line, index) => {
            const slackLeft = line.xStart - X_L;
            const slackRight = X_R - line.xEnd;
            const isLastLine =
                line.runs[0].isLastLine ?? (index === lines.length - 1);

            if (!isLastLine) {
                expect(Math.abs(slackLeft)).toBeLessThanOrEqual(epsilon);
                expect(Math.abs(slackRight)).toBeLessThanOrEqual(epsilon);
            } else {
                // last line: left aligned, with slack on the right
                expect(Math.abs(slackLeft)).toBeLessThanOrEqual(epsilon);
                expect(slackRight).toBeGreaterThan(epsilon);
            }
        });
    });

    it("avoids collisions for fragmented inline runs in justified lines", async () => {
        const html = `
      <div style="width: 300px; font-size: 16px; text-align: justify;">
        This is <b>bold text</b> in a justified line that should not overlap.
      </div>
    `;

        const renderTree = await renderTreeForHtml(html);
        const root = renderTree.root;
        const paragraphBox = root.children[0];

        const allRuns = (await renderRuns(html)).filter(
            (r) => r.text.length > 0 && typeof r.lineIndex === "number",
        );

        // Group by line
        const byLine = new Map<number, typeof allRuns>();

        for (const run of allRuns) {
            const idx = run.lineIndex as number;
            const list = byLine.get(idx);
            if (list) list.push(run);
            else byLine.set(idx, [run]);
        }

        const epsilon = 0.5;

        for (const lineRuns of byLine.values()) {
            lineRuns.sort(
                (a, b) => (a.lineMatrix?.e ?? 0) - (b.lineMatrix?.e ?? 0),
            );

            for (let i = 1; i < lineRuns.length; i++) {
                const prev = lineRuns[i - 1];
                const curr = lineRuns[i];

                const prevX = prev.lineMatrix?.e ?? 0;
                const currX = curr.lineMatrix?.e ?? 0;
                const prevWidth = prev.advanceWidth ?? 0;

                // non-decreasing and non-overlapping segments within the same line
                expect(currX).toBeGreaterThanOrEqual(prevX);
                expect(currX + epsilon).toBeGreaterThanOrEqual(prevX + prevWidth);
            }
        }

        const hasJustification = allRuns.some(
            (r) => (r.wordSpacing ?? 0) > 0,
        );
        expect(hasJustification).toBe(true);
    });

    it("does not justify the last line of a multi-line paragraph", async () => {
        const html = `
      <div style="width: 300px; text-align: justify;">
        First line with enough text to wrap across multiple words in the first line.
        Second line is shorter.
      </div>
    `;

        const runs = await renderRuns(html);
        const lastRun = runs[runs.length - 1];

        expect(lastRun.isLastLine ?? true).toBe(true);
        expect(lastRun.wordSpacing ?? 0).toBe(0);
    });
});
