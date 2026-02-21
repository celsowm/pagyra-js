import { collectBoxes, renderTreeForHtml } from "../helpers/render-utils.js";
import type { RenderBox } from "../../src/pdf/types.js";

function findByTag(boxes: RenderBox[], tagName: string): RenderBox {
  const found = boxes.find((b) => b.tagName === tagName);
  if (!found) {
    throw new Error(`Expected to find <${tagName}> in render tree`);
  }
  return found;
}

describe("flex auto-height behavior", () => {
  it("does not stretch column flex containers with auto height to viewport height", async () => {
    const html = `
      <header style="display:flex;flex-direction:column;padding:16px;border:1px solid #000;gap:8px">
        <div style="font-size:16px">Titulo</div>
        <p style="margin:0;font-size:14px;line-height:1.4">Subtitulo</p>
      </header>
    `;

    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const header = findByTag(boxes, "header");

    expect(header.borderBox.height).toBeLessThan(300);
    expect(header.borderBox.height).toBeGreaterThan(40);
  });

  it("keeps honoring explicit height for column flex containers", async () => {
    const html = `
      <header style="display:flex;flex-direction:column;height:260px;box-sizing:border-box;padding:16px;border:1px solid #000;gap:8px">
        <div style="font-size:16px">Titulo</div>
        <p style="margin:0;font-size:14px;line-height:1.4">Subtitulo</p>
      </header>
    `;

    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const header = findByTag(boxes, "header");

    expect(header.borderBox.height).toBeCloseTo(260, 3);
  });
});

