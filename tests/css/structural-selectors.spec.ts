import type { LayoutNode } from "../../src/dom/node.js";
import {
  createSelectorMatcher,
  type DomLikeElement,
} from "../../src/css/selectors/matcher.js";
import { parseDocument, wrapHtml } from "../../src/html-to-pdf/html-parser.js";
import { prepareHtmlRender } from "../../src/html-to-pdf/prepare-html-render.js";

function matches(document: Document, selector: string, id: string): boolean {
  const matcher = createSelectorMatcher(selector);
  const element = document.getElementById(id);
  if (!matcher || !element) {
    throw new Error(`Unable to match ${selector} against ${id}`);
  }
  return matcher(element as unknown as DomLikeElement);
}

function findLayoutNodeById(root: LayoutNode, id: string): LayoutNode {
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

describe("structural CSS selectors", () => {
  const document = parseDocument(wrapHtml(`
    <section id="mixed">
      <p id="p1"></p>
      <span id="span1"></span>
      <p id="p2"></p>
      <em id="em1"></em>
    </section>
    <div id="single"><i id="only"></i></div>
    <div id="empty"></div>
    <div id="comment"><!-- ignored --></div>
    <div id="whitespace"> </div>
  `));

  if (!document) {
    throw new Error("Unable to build selector fixture");
  }

  it("matches first, last and nth elements of the same type", () => {
    expect(matches(document, "p:first-of-type", "p1")).toBe(true);
    expect(matches(document, "p:first-of-type", "p2")).toBe(false);
    expect(matches(document, "p:last-of-type", "p2")).toBe(true);
    expect(matches(document, "p:nth-of-type(2)", "p2")).toBe(true);
    expect(matches(document, "section > p:nth-of-type(2)", "p2")).toBe(true);
  });

  it("matches only-child and only-of-type independently", () => {
    expect(matches(document, "i:only-child", "only")).toBe(true);
    expect(matches(document, "em:only-of-type", "em1")).toBe(true);
    expect(matches(document, "p:only-of-type", "p1")).toBe(false);
  });

  it("implements :empty using CSS text-node semantics", () => {
    expect(matches(document, "div:empty", "empty")).toBe(true);
    expect(matches(document, "div:empty", "comment")).toBe(true);
    expect(matches(document, "div:empty", "whitespace")).toBe(false);
    expect(matches(document, "div:empty", "single")).toBe(false);
  });

  it("feeds structural matches into the author cascade", async () => {
    const prepared = await prepareHtmlRender({
      html: `<article><p id="first">First</p><span>Middle</span><p id="second">Second</p></article>`,
      css: `
        p { color: #111111; }
        article > p:nth-of-type(2) { color: #ff0000; }
      `,
      pagedBodyMargin: "zero",
    });

    expect(findLayoutNodeById(prepared.layoutRoot, "first").style.color).toBe("#111111");
    expect(findLayoutNodeById(prepared.layoutRoot, "second").style.color).toBe("#ff0000");
  });
});
