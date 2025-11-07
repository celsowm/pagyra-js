import { describe, expect, it } from "vitest";
import {
  ComputedStyle,
  Display,
  LayoutNode,
  layoutTree,
} from "../src/index.js";
import { prepareHtmlRender } from "../src/html-to-pdf.js";

const renderDefaults = {
  viewportWidth: 600,
  viewportHeight: 800,
  pageWidth: 600,
  pageHeight: 800,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
};

function findTextNodeByContent(root: LayoutNode, text: string): LayoutNode | undefined {
  let match: LayoutNode | undefined;
  root.walk((node) => {
    if (!node.tagName && node.textContent?.includes(text) && !match) {
      match = node;
    }
  });
  return match;
}

describe("text-indent layout", () => {
  it("applies positive and negative offsets to the first line of block containers", () => {
    const root = new LayoutNode(new ComputedStyle());

    const indentedBlock = new LayoutNode(
      new ComputedStyle({
        display: Display.Block,
        textIndent: 48,
      }),
    );
    const indentedText = new LayoutNode(
      new ComputedStyle({ display: Display.Inline }),
      [],
      { textContent: "First line should start later." },
    );
    indentedBlock.appendChild(indentedText);

    const hangingBlock = new LayoutNode(
      new ComputedStyle({
        display: Display.Block,
        textIndent: -32,
      }),
    );
    const hangingText = new LayoutNode(
      new ComputedStyle({ display: Display.Inline }),
      [],
      { textContent: "Negative indent should shift left." },
    );
    hangingBlock.appendChild(hangingText);

    root.appendChild(indentedBlock);
    root.appendChild(hangingBlock);

    layoutTree(root, { width: 320, height: 640 });

    expect(indentedBlock.establishesIFC).toBe(true);
    expect(hangingBlock.establishesIFC).toBe(true);

    expect(indentedText.box.x).toBeCloseTo(48, 4);
    expect(hangingText.box.x).toBeCloseTo(-32, 4);
  });

  it("does not indent inline formatting contexts created by inline elements", () => {
    const root = new LayoutNode(new ComputedStyle());
    const host = new LayoutNode(new ComputedStyle({ display: Display.Block }));
    root.appendChild(host);

    const inlineContainer = new LayoutNode(
      new ComputedStyle({
        display: Display.Inline,
        textIndent: 30,
      }),
    );
    const innerText = new LayoutNode(
      new ComputedStyle({ display: Display.Inline }),
      [],
      { textContent: "Inline descendants should stay aligned." },
    );
    inlineContainer.appendChild(innerText);
    host.appendChild(inlineContainer);

    layoutTree(root, { width: 320, height: 200 });

    expect(host.establishesIFC).toBe(true);
    expect(Math.round(innerText.box.x)).toBe(Math.round(inlineContainer.box.x));
  });
});

describe("text-indent integration", () => {
  it("resolves percentages relative to the containing block width", async () => {
    const html = `
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; }
            body { font-family: Arial; }
            .row {
              width: 400px;
            }
            .row + .row {
              margin-top: 12px;
            }
            .percent {
              text-indent: 25%;
            }
            .plain {
              text-indent: 0;
            }
          </style>
        </head>
        <body>
          <div class="row percent">Percent indent text sample.</div>
          <div class="row plain">Plain text baseline.</div>
        </body>
      </html>
    `;

    const { layoutRoot } = await prepareHtmlRender({
      html,
      css: "",
      ...renderDefaults,
    });

    const percentText = findTextNodeByContent(layoutRoot, "Percent indent text sample");
    const plainText = findTextNodeByContent(layoutRoot, "Plain text baseline");

    expect(percentText).toBeDefined();
    expect(plainText).toBeDefined();
    if (!percentText || !plainText) {
      return;
    }

    const delta = percentText.box.x - plainText.box.x;
    expect(delta).toBeCloseTo(100, 3); // 25% of 400px
  });

  it("inherits text-indent from ancestor blocks unless overridden", async () => {
    const html = `
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; }
            body { font-family: Arial; }
            .wrap {
              width: 320px;
            }
            .with-indent {
              text-indent: 32px;
            }
            p {
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="wrap with-indent">
            <p>Inherited indent text.</p>
          </div>
          <p class="wrap" style="text-indent: 0;">Reset indent text.</p>
        </body>
      </html>
    `;

    const { layoutRoot } = await prepareHtmlRender({
      html,
      css: "",
      ...renderDefaults,
    });

    const inherited = findTextNodeByContent(layoutRoot, "Inherited indent text");
    const reset = findTextNodeByContent(layoutRoot, "Reset indent text");

    expect(inherited).toBeDefined();
    expect(reset).toBeDefined();
    if (!inherited || !reset) {
      return;
    }

    const delta = inherited.box.x - reset.box.x;
    expect(delta).toBeCloseTo(32, 3);
  });
});
