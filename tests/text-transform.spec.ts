import { describe, it, expect } from "vitest";
import type { LayoutNode } from "../src/dom/node.js";
import { prepareHtmlRender } from "../src/html-to-pdf.js";

const renderDefaults = {
  viewportWidth: 600,
  viewportHeight: 800,
  pageWidth: 600,
  pageHeight: 800,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
};

function findTextNode(root: LayoutNode, snippet: string, occurrence = 1): LayoutNode | undefined {
  let seen = 0;
  let match: LayoutNode | undefined;
  root.walk((node) => {
    if (!node.tagName && node.textContent?.includes(snippet)) {
      seen += 1;
      if (seen === occurrence && !match) {
        match = node;
      }
    }
  });
  return match;
}

describe("text-transform integration", () => {
  it("applies uppercase, lowercase, and capitalize transforms before layout", async () => {
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial; margin: 0; }
            .upper { text-transform: uppercase; }
            .lower { text-transform: lowercase; }
            .caps { text-transform: capitalize; }
            p { margin: 0 0 8px 0; }
          </style>
        </head>
        <body>
          <p class="upper">Mixed Case Title.</p>
          <p class="lower">Mixed Case Title.</p>
          <p class="caps">unUSual hyphen-case words</p>
        </body>
      </html>
    `;

    const { layoutRoot } = await prepareHtmlRender({
      html,
      css: "",
      ...renderDefaults,
    });

    const upper = findTextNode(layoutRoot, "Mixed Case Title.", 1);
    const lower = findTextNode(layoutRoot, "Mixed Case Title.", 2);
    const caps = findTextNode(layoutRoot, "unUSual hyphen-case words", 1);

    expect(upper).toBeDefined();
    expect(lower).toBeDefined();
    expect(caps).toBeDefined();
    if (!upper || !lower || !caps) {
      return;
    }

    expect(upper.lineBoxes?.[0].text).toBe("MIXED CASE TITLE.");
    expect(lower.lineBoxes?.[0].text).toBe("mixed case title.");
    expect(caps.lineBoxes?.[0].text).toBe("Unusual Hyphen-Case Words");
  });

  it("inherits and overrides text-transform across descendants", async () => {
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial; margin: 0; }
            .all-upper { text-transform: uppercase; }
            .all-lower { text-transform: lowercase; }
            .capitalize { text-transform: capitalize; }
            span { display: inline; }
          </style>
        </head>
        <body>
          <div class="all-upper">
            <span class="inherit">Mixed Spacing Text</span>
            <span class="reset" style="text-transform: none;">Mixed Spacing Text</span>
          </div>
          <div class="all-lower">
            <span class="capitalize">MiXeD Case TEXT</span>
          </div>
        </body>
      </html>
    `;

    const { layoutRoot } = await prepareHtmlRender({
      html,
      css: "",
      ...renderDefaults,
    });

    const inherited = findTextNode(layoutRoot, "Mixed Spacing Text", 1);
    const reset = findTextNode(layoutRoot, "Mixed Spacing Text", 2);
    const capitalized = findTextNode(layoutRoot, "MiXeD Case TEXT", 1);

    expect(inherited).toBeDefined();
    expect(reset).toBeDefined();
    expect(capitalized).toBeDefined();
    if (!inherited || !reset || !capitalized) {
      return;
    }

    expect(inherited.lineBoxes?.[0].text).toBe("MIXED SPACING TEXT");
    expect(reset.lineBoxes?.[0].text).toBe("Mixed Spacing Text");
    expect(capitalized.lineBoxes?.[0].text).toBe("Mixed Case Text");
  });
});
