import { collectBoxes, renderTreeForHtml } from "../helpers/render-utils.js";
import type { RenderBox } from "../../src/pdf/types.js";

describe("flex wrap card layout", () => {
  it("wraps items to a new line when flex-basis exceeds available width", async () => {
    const html =
      "<!DOCTYPE html><html><body style=\"margin:0;\"><main style=\"display:flex;flex-wrap:wrap;gap:20px;width:600px;\"><article style=\"flex:1 1 200px;height:100px;\">A</article><article style=\"flex:1 1 200px;height:100px;\">B</article><article style=\"flex:1 1 200px;height:100px;\">C</article></main></body></html>";

    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const cards = boxes
      .filter((box) => box.tagName === "article")
      .sort((a, b) => (a.contentBox.y - b.contentBox.y) || (a.contentBox.x - b.contentBox.x));

    expect(cards).toHaveLength(3);

    expect(Math.abs(cards[0].contentBox.y - cards[1].contentBox.y)).toBeLessThan(1);
    expect(cards[2].contentBox.y).toBeGreaterThan(cards[0].contentBox.y + 100);
    expect(cards[0].contentBox.width).toBeGreaterThan(180);
    expect(cards[0].contentBox.width).toBeLessThan(320);
  });
});
