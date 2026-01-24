import { renderRuns } from "../helpers/render-utils.js";

describe("PDF text alignment (non-justify)", () => {
    it("does not apply justification to left/center/right alignments", async () => {
        const html = `
      <div>
        <p style="width: 260px; text-align: left;">
          Some sample text that wraps into multiple lines for left.
        </p>
        <p style="width: 260px; text-align: center;">
          Some sample text that wraps into multiple lines for center.
        </p>
        <p style="width: 260px; text-align: right;">
          Some sample text that wraps into multiple lines for right.
        </p>
      </div>
    `;

        const runs = await renderRuns(html);

        // no positive wordSpacing anywhere
        const hasWordSpacing = runs.some((r) => (r.wordSpacing ?? 0) > 0);
        expect(hasWordSpacing).toBe(false);
    });
});
