import { renderRuns, renderTreeForHtml, collectBoxes, collectRuns } from "../helpers/render-utils.js";

const TAN_20 = Math.tan((20 * Math.PI) / 180);

describe("PDF text transforms", () => {
  it("applies skewX to text runs (keeps linear components in CSS space)", async () => {
    const html = `<span style="display:inline-block; font-size:20px; transform: skewX(20deg);">Skewed</span>`;
    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const skewedBox = boxes.find((b) => b.transform !== undefined && b.textRuns.some(r => r.text.includes("Skewed")));
    expect(skewedBox).toBeDefined();

    // transform matrix in CSS coordinates from the style; skewX should set c to tan(20deg)
    expect(Math.abs((skewedBox!.transform?.c ?? 0) - TAN_20)).toBeLessThan(1e-3);
    expect(skewedBox!.transform?.a ?? 1).toBeCloseTo(1);
    expect(skewedBox!.transform?.d ?? 1).toBeCloseTo(1);
  });

  it("keeps text baseline inside table cell", async () => {
    const html = `
      <table style="border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; font-size: 16px;">Cell text</td>
        </tr>
      </table>
    `;
    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const tdBox = boxes.find((b) => b.tagName === "td");
    expect(tdBox).toBeDefined();

    const runs = collectRuns(tdBox!);
    expect(runs.length).toBeGreaterThan(0);

    const cellTop = tdBox!.contentBox.y;
    const cellBottom = tdBox!.contentBox.y + tdBox!.contentBox.height;
    const slack = 10; // allow a few px for font metrics/padding interplay
    for (const run of runs) {
      const baseline = run.lineMatrix?.f ?? 0;
      expect(baseline).toBeGreaterThanOrEqual(cellTop - slack);
      expect(baseline).toBeLessThanOrEqual(cellBottom + slack);
    }
  });
});
