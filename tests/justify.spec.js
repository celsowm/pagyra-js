import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
function collectRuns(box) {
    const runs = [...box.textRuns];
    for (const child of box.children) {
        runs.push(...collectRuns(child));
    }
    return runs;
}
async function renderRuns(html, css = "") {
    const wrappedHtml = /<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`;
    const { renderTree } = await prepareHtmlRender({
        html: wrappedHtml,
        css,
        viewportWidth: 800,
        viewportHeight: 600,
        pageWidth: 800,
        pageHeight: 600,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return collectRuns(renderTree.root);
}
describe("text-align: justify", () => {
    it("distributes slack across non-final lines", async () => {
        const paragraph = `
      <div style="width: 360px; font-size: 16px; text-align: justify;">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent viverra
        augue quis libero tincidunt, ac condimentum sapien faucibus. Fusce finibus
        odio nisi, vitae laoreet metus convallis ut. Integer consequat magna sed
        turpis efficitur, eget dignissim augue interdum.
      </div>
    `;
        const runs = await renderRuns(paragraph);
        expect(runs.length).toBeGreaterThan(1);
        const spacings = runs.map((run) => run.wordSpacing ?? 0);
        const positiveSpacings = spacings.filter((value) => value > 0);
        expect(positiveSpacings.length).toBeGreaterThan(0);
        expect(spacings[spacings.length - 1]).toBe(0);
    });
    it("keeps single-line paragraphs left-aligned", async () => {
        const html = `<p style="width: 480px; text-align: justify;">Short line only.</p>`;
        const runs = await renderRuns(html);
        expect(runs.length).toBe(1);
        expect(runs[0].wordSpacing ?? 0).toBe(0);
    });
});
