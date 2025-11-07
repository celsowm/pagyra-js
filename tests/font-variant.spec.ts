import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import type { LayoutNode } from "../src/dom/node.js";

function findNodeByTag(root: LayoutNode, tag: string): LayoutNode | undefined {
  let match: LayoutNode | undefined;
  root.walk((node) => {
    if (node.tagName?.toLowerCase() === tag) {
      match = node;
    }
  });
  return match;
}

describe("font-variant", () => {
  it("should parse font-variant: small-caps", async () => {
    const html = `
      <html>
        <head>
          <style>
            div {
              font-variant: small-caps;
            }
          </style>
        </head>
        <body>
          <div>Hello</div>
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

    const divNode = findNodeByTag(layoutRoot, "div");
    expect(divNode).toBeDefined();
    if (!divNode) {
      return;
    }

    expect(divNode.style.fontVariant).toBe("small-caps");
  });
});
