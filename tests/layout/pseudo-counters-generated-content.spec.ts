import { collectBoxes, collectRuns, renderTreeForHtml } from "../helpers/render-utils.js";

describe("pseudo-elements with generated content and counters", () => {
  it("renders ::before counter() values with decimal-leading-zero", async () => {
    const html = `
      <div class="counter-demo" style="counter-reset: steps 0;">
        <div class="item">Alpha</div>
        <div class="item">Beta</div>
        <div class="item">Gamma</div>
      </div>
    `;
    const css = `
      .item { position: relative; counter-increment: steps 1; padding-left: 24px; }
      .item::before { content: counter(steps, decimal-leading-zero); position: absolute; left: -12px; top: 0; }
    `;

    const renderTree = await renderTreeForHtml(html, css);
    const runs = collectRuns(renderTree.root).map((r) => r.text);

    expect(runs).toContain("01");
    expect(runs).toContain("02");
    expect(runs).toContain("03");
  });

  it("renders ::after generated text after host text", async () => {
    const html = `<p class="tag">Alpha</p>`;
    const css = `.tag::after { content: "X"; }`;

    const renderTree = await renderTreeForHtml(html, css);
    const runs = collectRuns(renderTree.root).filter((r) => r.text.length > 0);
    const joined = runs.map((r) => r.text).join("");

    expect(joined).toContain("AlphaX");
  });

  it("creates an absolute positioned render box for pseudo-elements", async () => {
    const html = `<div id="host" class="item">Alpha</div>`;
    const css = `
      .item { position: relative; counter-reset: s 0; counter-increment: s 1; padding-left: 24px; }
      .item::before {
        content: counter(s, decimal-leading-zero);
        position: absolute;
        left: -12px;
        top: 0;
        background: #0ea5e9;
        padding: 2px 4px;
      }
    `;

    const renderTree = await renderTreeForHtml(html, css);
    const boxes = collectBoxes(renderTree.root);

    const hostBox = boxes.find((box) => box.customData?.id === "host");
    const pseudoBox = boxes.find((box) => box.customData?.pseudoType === "before");

    expect(hostBox).toBeDefined();
    expect(pseudoBox).toBeDefined();
    expect(pseudoBox?.positioning.type).toBe("absolute");
    expect((pseudoBox?.borderBox.x ?? 0)).toBeLessThan(hostBox?.borderBox.x ?? 0);
  });
});
