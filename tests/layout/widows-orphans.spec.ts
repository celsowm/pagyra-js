import type { LayoutNode } from "../../src/dom/node.js";
import { prepareHtmlRender } from "../../src/html-to-pdf/prepare-html-render.js";

function findById(root: LayoutNode, id: string): LayoutNode {
  let found: LayoutNode | undefined;
  root.walk((node) => {
    if (node.customData?.id === id) {
      found = node;
    }
  });
  if (!found) {
    throw new Error(`Missing layout node ${id}`);
  }
  return found;
}

async function render(spacerHeight: number, lines: string, constraints: string) {
  return prepareHtmlRender({
    html: `<div id="spacer"></div><p id="target">${lines}</p><div id="following">Following</div>`,
    css: `
      @page { size: 400px 200px; margin: 0; }
      body, div, p { margin: 0; padding: 0; }
      #spacer { height: ${spacerHeight}px; }
      #target { font-size: 16px; line-height: 20px; white-space: pre-line; ${constraints} }
      #following { height: 20px; }
    `,
    pagedBodyMargin: "zero",
  });
}

describe("widows and orphans", () => {
  it("parses positive line constraints", async () => {
    const prepared = await render(0, "one\ntwo", "widows: 4; orphans: 3;");
    const target = findById(prepared.layoutRoot, "target");

    expect(target.style.widows).toBe(4);
    expect(target.style.orphans).toBe(3);
  });

  it("inherits line constraints from ancestors", async () => {
    const prepared = await prepareHtmlRender({
      html: '<section style="widows: 5; orphans: 4"><p id="target">Inherited</p></section>',
      css: "body, section, p { margin: 0; padding: 0; }",
      pagedBodyMargin: "zero",
    });
    const target = findById(prepared.layoutRoot, "target");

    expect(target.style.widows).toBe(5);
    expect(target.style.orphans).toBe(4);
  });

  it("moves a paragraph when too few orphan lines fit", async () => {
    const unrestricted = await render(170, "one\ntwo\nthree", "widows: 1; orphans: 1;");
    const constrained = await render(170, "one\ntwo\nthree", "widows: 1; orphans: 2;");

    expect(findById(unrestricted.layoutRoot, "target").box.y).toBeCloseTo(170, 4);
    expect(findById(constrained.layoutRoot, "target").box.y).toBeCloseTo(200, 4);
    expect(findById(constrained.layoutRoot, "following").box.y).toBeGreaterThanOrEqual(260);
  });

  it("moves a paragraph when the next page would have too few widow lines", async () => {
    const unrestricted = await render(130, "one\ntwo\nthree\nfour", "widows: 1; orphans: 1;");
    const constrained = await render(130, "one\ntwo\nthree\nfour", "widows: 2; orphans: 1;");

    expect(findById(unrestricted.layoutRoot, "target").box.y).toBeCloseTo(130, 4);
    expect(findById(constrained.layoutRoot, "target").box.y).toBeCloseTo(200, 4);
  });

  it("ignores invalid zero and fractional values", async () => {
    const prepared = await render(0, "one\ntwo", "widows: 0; orphans: 1.5;");
    const target = findById(prepared.layoutRoot, "target");

    expect(target.style.widows).toBe(2);
    expect(target.style.orphans).toBe(2);
  });
});
