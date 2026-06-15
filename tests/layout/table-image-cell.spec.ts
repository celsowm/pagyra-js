import { describe, it, expect } from "vitest";
import { collectBoxes, renderTreeForHtml } from "../helpers/render-utils.js";

// Minimal valid 1×1 PNG used as image payload; intrinsic dimensions are
// overridden by the HTML width/height attributes in each test.
const ONE_BY_ONE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8/5+hHgAHggJ/P95syQAAAABJRU5ErkJggg==";

describe("table cell with image content", () => {
  it("row height equals the image height when the left cell contains only an image", async () => {
    const html = `
      <table>
        <tr>
          <td><img src="data:image/png;base64,${ONE_BY_ONE_PNG}" width="60" height="80" /></td>
          <td><p style="font-size:12px;margin:0">Short text</p></td>
        </tr>
      </table>
    `;
    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const table = boxes.find((b) => b.tagName === "table");
    expect(table).toBeDefined();
    // The row height must accommodate the 80px-tall image.
    expect(table!.contentBox.height).toBeGreaterThanOrEqual(80);
  });

  it("image-only cell has non-zero content height and the row has matching height", async () => {
    const html = `
      <table>
        <tr>
          <td><img src="data:image/png;base64,${ONE_BY_ONE_PNG}" width="40" height="50" /></td>
          <td>label</td>
        </tr>
      </table>
    `;
    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const img = boxes.find((b) => b.tagName === "img");
    expect(img).toBeDefined();
    expect(img!.contentBox.height).toBeGreaterThanOrEqual(50);
  });

  it("two-row table with image cells renders without zero-height rows", async () => {
    const html = `
      <table>
        <tr>
          <td><img src="data:image/png;base64,${ONE_BY_ONE_PNG}" width="50" height="60" /></td>
          <td>Row 1 text</td>
        </tr>
        <tr>
          <td><img src="data:image/png;base64,${ONE_BY_ONE_PNG}" width="50" height="70" /></td>
          <td>Row 2 text</td>
        </tr>
      </table>
    `;
    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const table = boxes.find((b) => b.tagName === "table");
    expect(table).toBeDefined();
    // Total height must fit both image rows (60 + 70 = 130 minimum).
    expect(table!.contentBox.height).toBeGreaterThanOrEqual(130);
  });
});
