import { collectBoxes, renderTreeForHtml } from "../helpers/render-utils.js";
import type { RenderBox } from "../../src/pdf/types.js";

function articlesByPosition(boxes: RenderBox[]): RenderBox[] {
  return boxes
    .filter((box) => box.tagName === "article")
    .sort((a, b) => (a.contentBox.y - b.contentBox.y) || (a.contentBox.x - b.contentBox.x));
}

describe("flex wrap grow and align-content", () => {
  it("grows items per line and stretches wrapped lines across explicit height", async () => {
    const html =
      "<!DOCTYPE html><html><body style=\"margin:0;\"><main style=\"display:flex;flex-wrap:wrap;gap:20px;width:600px;height:500px;align-content:stretch;\"><article style=\"flex:1 1 200px;height:100px;\">A</article><article style=\"flex:1 1 200px;height:100px;\">B</article><article style=\"flex:1 1 200px;height:100px;\">C</article></main></body></html>";

    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const cards = articlesByPosition(boxes);

    expect(cards).toHaveLength(3);

    expect(Math.abs(cards[0].contentBox.y - cards[1].contentBox.y)).toBeLessThan(1);
    expect(cards[2].contentBox.y).toBeGreaterThan(220);

    expect(cards[0].contentBox.width).toBeCloseTo(cards[1].contentBox.width, 1);
    expect(cards[0].contentBox.width).toBeGreaterThan(280);
    expect(cards[2].contentBox.width).toBeGreaterThan(590);
  });
});
