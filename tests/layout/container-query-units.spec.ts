import { collectBoxes, renderTreeForHtml } from "../helpers/render-utils.js";
import type { RenderBox } from "../../src/pdf/types.js";

function findByTag(boxes: RenderBox[], tagName: string): RenderBox {
  const found = boxes.find((b) => b.tagName === tagName);
  if (!found) {
    throw new Error(`Expected to find <${tagName}> in render tree`);
  }
  return found;
}

describe("container query unit layout", () => {
  it("resolves cqw/cqh/cqmin/cqmax against containing block dimensions", async () => {
    const html =
      "<!DOCTYPE html><html><body style=\"margin:0;\"><section style=\"width:400px;height:300px;\"><div id=\"a\" style=\"width:50cqw;height:25cqh;\"></div><div id=\"b\" style=\"width:10cqmin;height:10cqmax;\"></div></section></body></html>";

    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root).filter((box) => box.tagName === "div");
    if (boxes.length !== 2) {
      throw new Error(`Expected exactly 2 divs, got ${boxes.length}`);
    }

    const first = boxes[0];
    const second = boxes[1];

    expect(first.contentBox.width).toBeCloseTo(200, 2);
    expect(first.contentBox.height).toBeCloseTo(75, 2);
    expect(second.contentBox.width).toBeCloseTo(30, 2);
    expect(second.contentBox.height).toBeCloseTo(40, 2);
  });
});
