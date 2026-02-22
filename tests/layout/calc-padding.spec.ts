import { collectBoxes, renderTreeForHtml } from "../helpers/render-utils.js";
import type { RenderBox } from "../../src/pdf/types.js";

function findByTag(boxes: RenderBox[], tagName: string): RenderBox {
  const found = boxes.find((b) => b.tagName === tagName);
  if (!found) {
    throw new Error(`Expected to find <${tagName}> in render tree`);
  }
  return found;
}

describe("calc() layout for padding", () => {
  it("resolves calc(px + %) using containing block width", async () => {
    const html =
      "<!DOCTYPE html><html><body style=\"margin:0;\"><main style=\"width:400px;padding:calc(10px + 2%);height:40px;background:#ddd;\">X</main></body></html>";

    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const main = findByTag(boxes, "main");

    const expectedPadding = 10 + 0.02 * 400;
    expect(main.contentBox.width).toBeCloseTo(400, 2);
    expect(main.borderBox.width).toBeCloseTo(400 + expectedPadding * 2, 2);
  });
});
