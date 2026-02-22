import { parseHTML } from "linkedom";

import { Display } from "../../src/css/enums.js";
import { ComputedStyle } from "../../src/css/style.js";
import { LayoutNode } from "../../src/dom/node.js";
import { convertTextDomNode, flushBufferedText } from "../../src/html/dom-converter/text.js";

describe("dom-converter/text whitespace handling", () => {
  it("preserves a single collapsed space between meaningful siblings", () => {
    const { document } = parseHTML(`<div><span>A</span>   <span>B</span></div>`);
    const root = document.querySelector("div");
    const textNode = root?.childNodes[1] ?? null;

    expect(textNode).toBeTruthy();

    const result = convertTextDomNode(textNode as Node, new ComputedStyle());

    expect(result).not.toBeNull();
    expect(result?.textContent).toBe(" ");
    expect(result?.customData).toMatchObject({
      preserveLeadingSpace: true,
      preserveTrailingSpace: true,
    });
  });

  it("drops whitespace-only text at the edge of an element", () => {
    const { document } = parseHTML(`<div>   <span>B</span></div>`);
    const root = document.querySelector("div");
    const textNode = root?.childNodes[0] ?? null;

    const result = convertTextDomNode(textNode as Node, new ComputedStyle());

    expect(result).toBeNull();
  });

  it("preserves buffered whitespace after inline content but drops it after block content", () => {
    const inlineChildren: LayoutNode[] = [new LayoutNode(new ComputedStyle({ display: Display.Inline }))];
    const blockChildren: LayoutNode[] = [new LayoutNode(new ComputedStyle({ display: Display.Block }))];
    const style = new ComputedStyle();

    flushBufferedText(inlineChildren, "   ", style);
    flushBufferedText(blockChildren, "   ", style);

    expect(inlineChildren.at(-1)?.textContent).toBe(" ");
    expect(blockChildren).toHaveLength(1);
  });
});
