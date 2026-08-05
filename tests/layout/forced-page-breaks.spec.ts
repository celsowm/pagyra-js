import type { LayoutNode } from "../../src/dom/node.js";
import { prepareHtmlRender } from "../../src/html-to-pdf/prepare-html-render.js";

function findById(root: LayoutNode, id: string): LayoutNode {
  let result: LayoutNode | undefined;
  root.walk((node) => {
    if (node.customData?.id === id) {
      result = node;
    }
  });
  if (!result) {
    throw new Error(`Layout node not found: ${id}`);
  }
  return result;
}

async function render(css: string) {
  return prepareHtmlRender({
    html: '<div id="first">First</div><div id="second">Second</div><div id="third">Third</div>',
    css: `
      @page { size: 400px 300px; margin: 0; }
      body, div { margin: 0; padding: 0; }
      div { height: 80px; }
      ${css}
    `,
    pagedBodyMargin: "zero",
  });
}

describe("forced page fragmentation", () => {
  it("applies break-before: page", async () => {
    const prepared = await render("#second { break-before: page; }");
    const second = findById(prepared.layoutRoot, "second");
    const third = findById(prepared.layoutRoot, "third");

    expect(second.style.breakBefore).toBe("page");
    expect(second.box.y).toBeCloseTo(300, 4);
    expect(third.box.y).toBeGreaterThanOrEqual(380);
  });

  it("applies break-after: page to following flow content", async () => {
    const prepared = await render("#first { break-after: page; }");
    const first = findById(prepared.layoutRoot, "first");
    const second = findById(prepared.layoutRoot, "second");

    expect(first.style.breakAfter).toBe("page");
    expect(first.box.y).toBeCloseTo(0, 4);
    expect(second.box.y).toBeCloseTo(300, 4);
  });

  it("maps legacy page-break aliases", async () => {
    const prepared = await render(`
      #first { page-break-after: always; }
      #second { page-break-inside: avoid; }
    `);
    const first = findById(prepared.layoutRoot, "first");
    const second = findById(prepared.layoutRoot, "second");

    expect(first.style.breakAfter).toBe("page");
    expect(second.style.breakInside).toBe("avoid");
    expect(second.box.y).toBeCloseTo(300, 4);
  });

  it("honors left and right page parity", async () => {
    const leftPrepared = await render("#second { break-before: left; }");
    const rightPrepared = await render("#second { break-before: right; }");

    expect(findById(leftPrepared.layoutRoot, "second").box.y).toBeCloseTo(300, 4);
    expect(findById(rightPrepared.layoutRoot, "second").box.y).toBeCloseTo(600, 4);
  });
});
