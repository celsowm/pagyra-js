import { describe, it, expect } from "vitest";
import { renderTreeForHtml, collectRuns, collectBoxes } from "../helpers/render-utils.js";

describe("inline-block shrink-wrap", () => {
    it("inline-block element should shrink to wrap its inline child content", async () => {
        const html = '<div style="display: inline-block"><span>Hello World</span></div>';
        const renderTree = await renderTreeForHtml(html);

        const boxes = collectBoxes(renderTree.root);
        const divBox = boxes.find(box => box.tagName === 'div');

        if (!divBox) {
            throw new Error("Div box not found");
        }

        // Get the text runs under the div
        const runs = collectRuns(divBox);
        const totalTextWidth = runs.reduce((sum, run) => sum + (run.advanceWidth ?? 0), 0);

        // The inline-block div should shrink to fit its content
        // Currently this fails because the layout engine doesn't properly handle inline-block shrink-wrapping
        expect(divBox.contentBox.width).toBeCloseTo(totalTextWidth, 1); // Allow minor rounding differences
    });
});
