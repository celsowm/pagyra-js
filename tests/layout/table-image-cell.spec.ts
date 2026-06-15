import { describe, it, expect } from "vitest";
import { collectBoxes, collectRuns, renderTreeForHtml } from "../helpers/render-utils.js";

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

describe("table cell with long mixed inline content (SEI signature regression)", () => {
  // Mirrors the SEI/ERJ signature block: a narrow image column on the left and a long
  // paragraph with mixed inline content (text + <b> + <a>) on the right. The paragraph
  // must wrap into several stacked lines instead of overlapping at a single position, and
  // the table must not overflow the page width.
  const html = `
    <table>
      <tr>
        <td><img src="data:image/png;base64,${ONE_BY_ONE_PNG}" width="60" height="80" /></td>
        <td>
          <p style="margin:0;font-size:11px;font-family:Calibri">Documento assinado eletronicamente por <b>Carlos Eduardo Carvalho Mendes</b>, <b>Assessor</b>, em 30/05/2025, conforme horario oficial de Brasilia, com fundamento no artigo quinto do <a href="http://example.gov">Decreto numero 46.126 de 20 de outubro de 2017</a> publicado oficialmente.</p>
        </td>
      </tr>
    </table>
  `;

  it("wraps the paragraph into multiple stacked lines (no overlap)", async () => {
    const tree = await renderTreeForHtml(html);
    const runs = collectRuns(tree.root).filter((r) => r.text.trim().length > 0);
    expect(runs.length).toBeGreaterThan(1);

    // Collect distinct baseline Y positions (lineMatrix.f). Wrapped text must occupy
    // several different vertical positions, not a single overlapping line.
    const ys = runs.map((r) => Math.round(r.lineMatrix.f));
    const distinctYs = new Set(ys);
    expect(distinctYs.size).toBeGreaterThan(2);

    // No two runs may sit at exactly the same (x, y) origin — that is the overlap signature.
    const origins = runs.map((r) => `${Math.round(r.lineMatrix.e)}:${Math.round(r.lineMatrix.f)}`);
    expect(new Set(origins).size).toBe(origins.length);
  });

  it("does not overflow the page content width", async () => {
    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const table = boxes.find((b) => b.tagName === "table");
    expect(table).toBeDefined();
    // Default test page is 794px wide with 48px margins => 698px of content width.
    expect(table!.borderBox.width).toBeLessThanOrEqual(698 + 1);
  });
});
