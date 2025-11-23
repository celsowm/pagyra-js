import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import type { LayoutNode } from "../src/dom/node.js";

const renderDefaults = {
  viewportWidth: 600,
  viewportHeight: 800,
  pageWidth: 600,
  pageHeight: 800,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
};

function textNodesByContent(root: LayoutNode, text: string): LayoutNode[] {
  const matches: LayoutNode[] = [];
  root.walk((node) => {
    if (!node.tagName && node.textContent === text) {
      matches.push(node);
    }
  });
  return matches;
}

describe("letter-spacing", () => {
  it("parses and applies letter-spacing to computed styles and intrinsic metrics", async () => {
    const html = `
      <html>
        <head>
          <style>
            body { font-family: 'Times New Roman'; font-size: 16px; line-height: 16px; }
            .spaced { letter-spacing: 4px; }
          </style>
        </head>
        <body>
          <p>
            <span class="normal">TEST</span>
            <span class="spaced">TEST</span>
          </p>
        </body>
      </html>
    `;

    const { layoutRoot } = await prepareHtmlRender({
      html,
      css: "",
      ...renderDefaults,
    });

    const textNodes = textNodesByContent(layoutRoot, "TEST");
    expect(textNodes.length).toBe(2);
    const [normal, spaced] = textNodes;

    expect(normal.style.letterSpacing).toBe(0);
    expect(spaced.style.letterSpacing).toBeCloseTo(4);

    expect(normal.intrinsicInlineSize).toBeGreaterThan(0);
    expect(spaced.intrinsicInlineSize).toBeGreaterThan(normal.intrinsicInlineSize ?? 0);
    const delta = (spaced.intrinsicInlineSize ?? 0) - (normal.intrinsicInlineSize ?? 0);
    expect(delta).toBeCloseTo(12, 0); // three gaps at 4px each
  });
});
