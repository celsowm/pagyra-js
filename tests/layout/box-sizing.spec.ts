import { collectBoxes, renderTreeForHtml } from "../helpers/render-utils.js";
import type { RenderBox } from "../../src/pdf/types.js";

function findByTag(boxes: RenderBox[], tagName: string): RenderBox {
  const found = boxes.find((b) => b.tagName === tagName);
  if (!found) {
    throw new Error(`Expected to find <${tagName}> in render tree`);
  }
  return found;
}

describe("layout box-sizing behavior", () => {
  it("uses content-box as default and border-box when specified for width", async () => {
    const html = `
      <article style="width:200px;padding:20px;border:5px solid #000">A</article>
      <aside style="width:200px;padding:20px;border:5px solid #000;box-sizing:border-box">B</aside>
    `;
    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);

    const contentBox = findByTag(boxes, "article");
    const borderBox = findByTag(boxes, "aside");

    expect(contentBox.contentBox.width).toBeCloseTo(200, 3);
    expect(contentBox.borderBox.width).toBeCloseTo(250, 3);

    expect(borderBox.contentBox.width).toBeCloseTo(150, 3);
    expect(borderBox.borderBox.width).toBeCloseTo(200, 3);
  });

  it("applies max-width in border-box space when box-sizing is border-box", async () => {
    const html = `
      <section style="width:400px;max-width:220px;padding:10px;border:5px solid #000;box-sizing:border-box">X</section>
    `;
    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const section = findByTag(boxes, "section");

    expect(section.contentBox.width).toBeCloseTo(190, 3);
    expect(section.borderBox.width).toBeCloseTo(220, 3);
  });

  it("applies explicit height in border-box space for block containers", async () => {
    const html = `
      <main style="height:200px;padding:20px;border:5px solid #000;box-sizing:border-box"></main>
    `;
    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const main = findByTag(boxes, "main");

    expect(main.contentBox.height).toBeCloseTo(150, 3);
    expect(main.borderBox.height).toBeCloseTo(200, 3);
  });

  it("applies explicit height in border-box space for grid and table containers", async () => {
    const html = `
      <div style="display:grid;height:200px;padding:20px;border:5px solid #000;box-sizing:border-box"></div>
      <table style="height:200px;padding:20px;border:5px solid #000;box-sizing:border-box">
        <tr><td>cell</td></tr>
      </table>
    `;
    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);

    const grid = boxes.find((b) => b.tagName === "div");
    const table = findByTag(boxes, "table");
    if (!grid) {
      throw new Error("Expected to find grid container");
    }

    expect(grid.contentBox.height).toBeCloseTo(150, 3);
    expect(grid.borderBox.height).toBeCloseTo(200, 3);

    expect(table.contentBox.height).toBeCloseTo(150, 3);
    expect(table.borderBox.height).toBeCloseTo(200, 3);
  });

  it("applies border-box sizing to form controls with explicit width and height", async () => {
    const html = `
      <input type="text" style="width:200px;height:60px;padding:10px;border:5px solid #000;box-sizing:border-box" value="ok" />
    `;
    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const input = findByTag(boxes, "input");

    expect(input.contentBox.width).toBeCloseTo(170, 3);
    expect(input.borderBox.width).toBeCloseTo(200, 3);
    expect(input.contentBox.height).toBeCloseTo(30, 3);
    expect(input.borderBox.height).toBeCloseTo(60, 3);
  });
});
