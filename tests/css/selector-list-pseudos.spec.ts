import type { LayoutNode } from "../../src/dom/node.js";
import {
  createSelectorMatcher,
  type DomLikeElement,
} from "../../src/css/selectors/matcher.js";
import { computeSpecificity } from "../../src/css/selectors/specificity.js";
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

describe("selector-list pseudo-classes", () => {
  const document = parseDocument(wrapHtml(`
    <article id="article" class="card featured"></article>
    <section id="section" class="card disabled"></section>
    <aside id="blocked" class="featured"></aside>
  `));

  if (!document) {
    throw new Error("Unable to build selector-list fixture");
  }

  it("matches any compound alternative in :is() and :where()", () => {
    expect(matches(document, ":is(article, .card.featured)", "article")).toBe(true);
    expect(matches(document, ":is(article, .card.featured)", "section")).toBe(false);
    expect(matches(document, ":where(section, #blocked)", "section")).toBe(true);
    expect(matches(document, ":where(section, #blocked)", "blocked")).toBe(true);
  });

  it("rejects every matching alternative in selector-list :not()", () => {
    expect(matches(document, ".card:not(.disabled, #blocked)", "article")).toBe(true);
    expect(matches(document, ".card:not(.disabled, #blocked)", "section")).toBe(false);
    expect(matches(document, ":not(.disabled, #blocked)", "blocked")).toBe(false);
  });

  it("supports nested functional pseudo-classes", () => {
    expect(matches(document, ":is(.card, :not(.featured))", "article")).toBe(true);
    expect(matches(document, ":is(.card, :not(.featured))", "section")).toBe(true);
    expect(matches(document, ":is(.card, :not(.featured))", "blocked")).toBe(false);
  });

  it("computes functional pseudo specificity according to Selectors Level 4", () => {
    expect(computeSpecificity(":where(#article, .card)")).toEqual([0, 0, 0]);
    expect(computeSpecificity(":is(.card, #article)")).toEqual([1, 0, 0]);
    expect(computeSpecificity("div:not(.card, #article)")).toEqual([1, 0, 1]);
    expect(computeSpecificity("article:where(#article).featured")).toEqual([0, 1, 1]);
  });

  it("uses zero specificity from :where() in the author cascade", async () => {
    const prepared = await prepareHtmlRender({
      html: `<div id="target" class="card">Target</div>`,
      css: `
        #target { color: #ff0000; }
        :where(#target).card { color: #0000ff; }
      `,
      pagedBodyMargin: "zero",
    });

    expect(findLayoutNodeById(prepared.layoutRoot, "target").style.color).toBe("#ff0000");
  });
});
