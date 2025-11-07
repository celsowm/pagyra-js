import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import type { LayoutNode } from "../src/dom/node.js";

function findNodeById(root: LayoutNode, id: string): LayoutNode | undefined {
  let match: LayoutNode | undefined;
  root.walk((node) => {
    if (node.tagName && node.customData?.id === id) {
      match = node;
    }
  });
  return match;
}

describe("em and rem units", () => {
  it("resolves em units using the element font-size", async () => {
    const html = `
      <html>
        <head>
          <style>
            body { font-size: 20px; }
            div {
              font-size: 1.5em;
              margin-left: 2em;
            }
          </style>
        </head>
        <body>
          <div id="target">Hello</div>
        </body>
      </html>
    `;

    const { layoutRoot } = await prepareHtmlRender({
      html,
      css: "",
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 800,
      pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const node = findNodeById(layoutRoot, "target");
    expect(node).toBeDefined();
    if (!node) return;

    expect(node.style.fontSize).toBeCloseTo(30); // 1.5em * 20px
    const marginLeft = node.style.marginLeft;
    expect(typeof marginLeft).toBe("number");
    expect(marginLeft).toBeCloseTo(60); // 2em * 30px
  });

  it("resolves rem units relative to the root html font-size", async () => {
    const html = `
      <html>
        <head>
          <style>
            html { font-size: 10px; }
            body { font-size: 18px; }
            div {
              margin-right: 3rem;
              padding-top: 1.5rem;
            }
          </style>
        </head>
        <body>
          <div id="rem-target">World</div>
        </body>
      </html>
    `;

    const { layoutRoot } = await prepareHtmlRender({
      html,
      css: "",
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 800,
      pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const node = findNodeById(layoutRoot, "rem-target");
    expect(node).toBeDefined();
    if (!node) return;

    const marginRight = node.style.marginRight;
    expect(typeof marginRight).toBe("number");
    expect(marginRight).toBeCloseTo(30); // 3 * 10px

    const paddingTop = node.style.paddingTop;
    expect(typeof paddingTop).toBe("number");
    expect(paddingTop).toBeCloseTo(15); // 1.5 * 10px
  });
});

