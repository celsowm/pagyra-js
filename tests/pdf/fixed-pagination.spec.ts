import type { PositionedLayer, RenderBox } from "../../src/pdf/types.js";
import { paginateTree } from "../../src/pdf/pagination.js";
import { prepareHtmlRender } from "../../src/html-to-pdf/prepare-html-render.js";

function layerBoxById(layer: PositionedLayer, id: string): RenderBox {
  const found = layer.boxes.find((box) => box.customData?.id === id);
  if (!found) {
    throw new Error(`Missing positioned box ${id}`);
  }
  return found;
}

function paintOrderContainsId(page: ReturnType<typeof paginateTree>[number], id: string): boolean {
  return page.paintOrder.some(
    (instruction) => instruction.type === "box" && instruction.box.customData?.id === id,
  );
}

describe("fixed-position pagination", () => {
  it("repeats fixed stacking contexts on every page with page-specific margins", async () => {
    const prepared = await prepareHtmlRender({
      html: `
        <div id="fixed"><span id="fixed-child">Fixed</span></div>
        <div id="spacer"></div>
      `,
      css: `
        @page { size: 300px 200px; margin: 10px; }
        @page :left { margin: 30px 10px 10px 50px; }
        @page :right { margin: 40px 20px 10px 60px; }
        @page :first { margin: 20px 20px 30px 40px; }
        html, body, div { margin: 0; padding: 0; }
        #fixed {
          position: fixed;
          top: 5px;
          left: 7px;
          width: 80px;
          height: 20px;
          opacity: 0.5;
          z-index: 5;
        }
        #spacer { height: 520px; }
      `,
      pagedBodyMargin: "zero",
    });

    const pages = paginateTree(prepared.renderTree.root, {
      pageHeight: 200,
      pageMargins: prepared.pageMargins,
    });

    expect(pages.length).toBeGreaterThanOrEqual(3);
    for (const page of pages) {
      expect(page.positionedLayersSortedByZ).toHaveLength(1);
      expect(page.positionedLayersSortedByZ[0].z).toBe(5);
      expect(page.positionedLayersSortedByZ[0].paintOrder?.some(
        (instruction) => instruction.type === "beginOpacity",
      )).toBe(true);
      expect(paintOrderContainsId(page, "fixed")).toBe(false);
      expect(paintOrderContainsId(page, "fixed-child")).toBe(false);
    }

    const first = layerBoxById(pages[0].positionedLayersSortedByZ[0], "fixed");
    const left = layerBoxById(pages[1].positionedLayersSortedByZ[0], "fixed");
    const right = layerBoxById(pages[2].positionedLayersSortedByZ[0], "fixed");
    const firstLocalY = first.borderBox.y - pages[0].pageOffsetY;
    const leftLocalY = left.borderBox.y - pages[1].pageOffsetY;
    const rightLocalY = right.borderBox.y - pages[2].pageOffsetY;

    expect(Number.isFinite(first.borderBox.x)).toBe(true);
    expect(Number.isFinite(firstLocalY)).toBe(true);
    expect(left.borderBox.x - first.borderBox.x).toBeCloseTo(10, 4);
    expect(right.borderBox.x - first.borderBox.x).toBeCloseTo(20, 4);
    expect(leftLocalY - firstLocalY).toBeCloseTo(10, 4);
    expect(rightLocalY - firstLocalY).toBeCloseTo(20, 4);
  });

  it("does not replicate absolute positioning as a fixed layer", async () => {
    const prepared = await prepareHtmlRender({
      html: `<div id="absolute">Absolute</div><div id="spacer"></div>`,
      css: `
        @page { size: 300px 200px; margin: 0; }
        html, body, div { margin: 0; padding: 0; }
        #absolute { position: absolute; top: 220px; left: 10px; width: 80px; height: 20px; }
        #spacer { height: 450px; }
      `,
      pagedBodyMargin: "zero",
    });

    const pages = paginateTree(prepared.renderTree.root, {
      pageHeight: 200,
      pageMargins: prepared.pageMargins,
    });

    expect(pages.every((page) => page.positionedLayersSortedByZ.length === 0)).toBe(true);
    const occurrences = pages.filter((page) => paintOrderContainsId(page, "absolute"));
    expect(occurrences).toHaveLength(1);
  });
});
