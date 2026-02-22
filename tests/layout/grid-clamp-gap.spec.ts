import { collectBoxes, renderTreeForHtml } from "../helpers/render-utils.js";
import type { RenderBox } from "../../src/pdf/types.js";

function findByTag(boxes: RenderBox[], tagName: string): RenderBox {
  const found = boxes.find((b) => b.tagName === tagName);
  if (!found) {
    throw new Error(`Expected to find <${tagName}> in render tree`);
  }
  return found;
}

describe("grid clamp track and gap layout", () => {
  it("applies clamp() for grid-template-columns and gap", async () => {
    const html =
      "<!DOCTYPE html><html><body style=\"margin:0;display:grid;grid-template-columns:clamp(150px,20vw,300px) 1fr;gap:clamp(10px,5vw,40px);width:600px;\"><aside style=\"height:20px;\">A</aside><main style=\"height:20px;\">B</main></body></html>";

    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const aside = findByTag(boxes, "aside");
    const main = findByTag(boxes, "main");

    const viewportWidth = 794 - 48 - 48;
    const expectedTrack = Math.min(Math.max(0.2 * viewportWidth, 150), 300);
    const expectedGap = Math.min(Math.max(0.05 * viewportWidth, 10), 40);

    expect(aside.contentBox.width).toBeCloseTo(expectedTrack, 1);
    expect(main.contentBox.x - aside.contentBox.x - aside.contentBox.width).toBeCloseTo(expectedGap, 1);
  });
});
