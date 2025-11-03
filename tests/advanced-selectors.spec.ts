import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";

// Mock DOM elements for testing selector matching directly
class MockElement {
  tagName: string;
  id?: string;
  _classList: string[];
  attributes: Record<string, string>;
  parentElement: MockElement | null = null;
  previousElementSibling: MockElement | null = null;
  nextElementSibling: MockElement | null = null;
  firstElementChild: MockElement | null = null;
  lastElementChild: MockElement | null = null;
  children: MockElement[] = [];

  constructor(tag: string, id?: string, classes: string[] = []) {
    this.tagName = tag;
    this.id = id;
    this._classList = classes;
    this.attributes = {};
  }

  get classList() {
    return {
      contains: (cls: string) => this._classList.includes(cls)
    };
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] || null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  addClass(cls: string): void {
    if (!this._classList.includes(cls)) {
      this._classList.push(cls);
    }
  }

  removeClass(cls: string): void {
    this._classList = this._classList.filter(c => c !== cls);
  }

  contains(cls: string): boolean {
    return this._classList.includes(cls);
  }
}

// Import the selector functions we want to test
import { parseSelector } from "../src/css/selectors/parser.js";
import { createSelectorMatcher } from "../src/css/selectors/matcher.js";

describe("Advanced CSS Selectors - Parser", () => {
  it("should parse basic selectors correctly", () => {
    const result = parseSelector("div");
    expect(result).not.toBeNull();
    expect(result![0].simple.tag).toBe("div");
  });

  it("should parse ID selectors", () => {
    const result = parseSelector("#myId");
    expect(result).not.toBeNull();
    expect(result![0].simple.id).toBe("myId");
  });

  it("should parse class selectors", () => {
    const result = parseSelector(".myClass");
    expect(result).not.toBeNull();
    expect(result![0].simple.classes).toContain("myClass");
  });

  it("should parse attribute selectors", () => {
    const result = parseSelector("[data-test='value']");
    expect(result).not.toBeNull();
    expect(result![0].simple.attrs).toHaveLength(1);
    expect(result![0].simple.attrs[0].name).toBe("data-test");
    expect(result![0].simple.attrs[0].op).toBe("=");
    expect(result![0].simple.attrs[0].value).toBe("value");
  });

  it("should parse attribute selectors with different operators", () => {
    const result = parseSelector("[title~='flower']");
    expect(result).not.toBeNull();
    expect(result![0].simple.attrs[0].op).toBe("~=");
    expect(result![0].simple.attrs[0].value).toBe("flower");
  });

  it("should parse pseudo-selectors", () => {
    const result = parseSelector(":first-child");
    expect(result).not.toBeNull();
    expect(result![0].simple.pseudos).toHaveLength(1);
    expect(result![0].simple.pseudos[0].kind).toBe("first-child");
  });

  it("should parse nth-child pseudo-selectors", () => {
    const result = parseSelector(":nth-child(2n+1)");
    expect(result).not.toBeNull();
    expect(result![0].simple.pseudos).toHaveLength(1);
    expect(result![0].simple.pseudos[0].kind).toBe("nth-child");
    const pseudo = result![0].simple.pseudos[0] as any;
    expect(pseudo.a).toBe(2);
    expect(pseudo.b).toBe(1);
  });

  it("should parse :not() pseudo-selectors", () => {
    const result = parseSelector(":not(.class)");
    expect(result).not.toBeNull();
    expect(result![0].simple.pseudos).toHaveLength(1);
    expect(result![0].simple.pseudos[0].kind).toBe("not");
    expect((result![0].simple.pseudos[0] as any).inner).toBeDefined();
  });

  it("should parse descendant combinators", () => {
    const result = parseSelector("div p");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![1].combinatorToLeft).toBe(" ");
  });

  it("should parse child combinators", () => {
    const result = parseSelector("div > p");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![1].combinatorToLeft).toBe(">");
  });

  it("should parse adjacent sibling combinators", () => {
    const result = parseSelector("div + p");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![1].combinatorToLeft).toBe("+");
  });

  it("should parse general sibling combinators", () => {
    const result = parseSelector("div ~ p");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![1].combinatorToLeft).toBe("~");
  });

  it("should handle complex selectors", () => {
    const result = parseSelector("div#myId.class1.class2[attr='value'] > p:nth-child(2n+1)");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
  });
});

describe("Advanced CSS Selectors - Matcher", () => {
  it("should match basic tag selectors", () => {
    const matcher = createSelectorMatcher("div");
    expect(matcher).not.toBeNull();

    const element = new MockElement("div");
    const result = matcher!(element as any);
    expect(result).toBe(true);
  });

  it("should not match wrong tag selectors", () => {
    const matcher = createSelectorMatcher("div");
    expect(matcher).not.toBeNull();

    const element = new MockElement("span");
    const result = matcher!(element as any);
    expect(result).toBe(false);
  });

  it("should match ID selectors", () => {
    const matcher = createSelectorMatcher("#testId");
    expect(matcher).not.toBeNull();

    const element = new MockElement("div", "testId");
    const result = matcher!(element as any);
    expect(result).toBe(true);
  });

  it("should match class selectors", () => {
    const matcher = createSelectorMatcher(".testClass");
    expect(matcher).not.toBeNull();

    const element = new MockElement("div");
    element.addClass("testClass");
    const result = matcher!(element as any);
    expect(result).toBe(true);
  });

  it("should match attribute selectors", () => {
    const matcher = createSelectorMatcher("[data-test='value']");
    expect(matcher).not.toBeNull();

    const element = new MockElement("div");
    element.setAttribute("data-test", "value");
    const result = matcher!(element as any);
    expect(result).toBe(true);
  });

  it("should match attribute selectors with different operators", () => {
    const matcher = createSelectorMatcher("[title~='flower']");
    expect(matcher).not.toBeNull();

    const element = new MockElement("div");
    element.setAttribute("title", "tulip flower");
    const result = matcher!(element as any);
    expect(result).toBe(true);
  });

  it("should match first-child pseudo-selector", () => {
    const matcher = createSelectorMatcher(":first-child");
    expect(matcher).not.toBeNull();

    // Create parent with first child
    const parent = new MockElement("div");
    const firstChild = new MockElement("p");
    const secondChild = new MockElement("p");
    
    parent.firstElementChild = firstChild;
    parent.children = [firstChild, secondChild];
    
    firstChild.parentElement = parent;
    secondChild.parentElement = parent;
    
    firstChild.previousElementSibling = null;
    firstChild.nextElementSibling = secondChild;
    secondChild.previousElementSibling = firstChild;
    secondChild.nextElementSibling = null;
    
    // First child should match
    const result1 = matcher!(firstChild as any);
    expect(result1).toBe(true);
    
    // Second child should not match
    const result2 = matcher!(secondChild as any);
    expect(result2).toBe(false);
  });

  it("should match last-child pseudo-selector", () => {
    const matcher = createSelectorMatcher(":last-child");
    expect(matcher).not.toBeNull();

    // Create parent with last child
    const parent = new MockElement("div");
    const firstChild = new MockElement("p");
    const lastChild = new MockElement("p");
    
    parent.lastElementChild = lastChild;
    parent.children = [firstChild, lastChild];
    
    firstChild.parentElement = parent;
    lastChild.parentElement = parent;
    
    firstChild.previousElementSibling = null;
    firstChild.nextElementSibling = lastChild;
    lastChild.previousElementSibling = firstChild;
    lastChild.nextElementSibling = null;
    
    // First child should not match
    const result1 = matcher!(firstChild as any);
    expect(result1).toBe(false);
    
    // Last child should match
    const result2 = matcher!(lastChild as any);
    expect(result2).toBe(true);
  });

  it("should match descendant combinators", () => {
    const matcher = createSelectorMatcher("div p");
    expect(matcher).not.toBeNull();

    // Create structure: div > span > p
    const grandParent = new MockElement("div");
    const parent = new MockElement("span");
    const child = new MockElement("p");
    
    grandParent.children = [parent];
    parent.children = [child];
    child.children = [];
    
    parent.parentElement = grandParent;
    child.parentElement = parent;
    
    // The p element should match the selector "div p" since it's a descendant of div
    const result = matcher!(child as any);
    expect(result).toBe(true);
  });

  it("should match child combinators", () => {
    const matcher = createSelectorMatcher("div > p");
    expect(matcher).not.toBeNull();

    // Create structure: div > p
    const parent = new MockElement("div");
    const child = new MockElement("p");
    
    parent.children = [child];
    child.children = [];
    child.parentElement = parent;
    
    // The p element should match the selector "div > p" since it's a direct child of div
    const result = matcher!(child as any);
    expect(result).toBe(true);
  });

  it("should not match child combinators when not direct child", () => {
    const matcher = createSelectorMatcher("div > p");
    expect(matcher).not.toBeNull();

    // Create structure: div > span > p (p is not a direct child of div)
    const grandParent = new MockElement("div");
    const parent = new MockElement("span");
    const child = new MockElement("p");
    
    grandParent.children = [parent];
    parent.children = [child];
    child.children = [];
    
    parent.parentElement = grandParent;
    child.parentElement = parent;
    
    // The p element should NOT match the selector "div > p" since it's not a direct child of div
    const result = matcher!(child as any);
    expect(result).toBe(false);
  });

  it("should match adjacent sibling combinators", () => {
    const matcher = createSelectorMatcher("h1 + p");
    expect(matcher).not.toBeNull();

    // Create structure: h1 + p (adjacent siblings)
    const h1 = new MockElement("h1");
    const p = new MockElement("p");
    
    h1.nextElementSibling = p;
    p.previousElementSibling = h1;
    
    // The p element should match the selector "h1 + p" since it's an adjacent sibling of h1
    const result = matcher!(p as any);
    expect(result).toBe(true);
  });

  it("should not match adjacent sibling when not adjacent", () => {
    const matcher = createSelectorMatcher("h1 + p");
    expect(matcher).not.toBeNull();

    // Create structure: h1 + span + p (p is not adjacent to h1)
    const h1 = new MockElement("h1");
    const span = new MockElement("span");
    const p = new MockElement("p");
    
    h1.nextElementSibling = span;
    span.previousElementSibling = h1;
    span.nextElementSibling = p;
    p.previousElementSibling = span;
    
    // The p element should NOT match the selector "h1 + p" since it's not adjacent to h1
    const result = matcher!(p as any);
    expect(result).toBe(false);
  });

  it("should match general sibling combinators", () => {
    const matcher = createSelectorMatcher("h1 ~ p");
    expect(matcher).not.toBeNull();

    // Create structure: h1 ~ p (general siblings)
    const h1 = new MockElement("h1");
    const span = new MockElement("span");
    const p = new MockElement("p");
    
    h1.nextElementSibling = span;
    span.previousElementSibling = h1;
    span.nextElementSibling = p;
    p.previousElementSibling = span;
    
    // The p element should match the selector "h1 ~ p" since it's a general sibling of h1
    const result = matcher!(p as any);
    expect(result).toBe(true);
  });

  it("should handle :not() pseudo-selector", () => {
    const matcher = createSelectorMatcher(":not(.special)");
    expect(matcher).not.toBeNull();

    // Element with the class should NOT match
    const specialElement = new MockElement("div");
    specialElement.addClass("special");
    const result1 = matcher!(specialElement as any);
    expect(result1).toBe(false);

    // Element without the class SHOULD match
    const normalElement = new MockElement("div");
    const result2 = matcher!(normalElement as any);
    expect(result2).toBe(true);
  });

  it("should handle complex selectors with multiple combinators", () => {
    const matcher = createSelectorMatcher("div > span ~ p");
    expect(matcher).not.toBeNull();

    // Create structure: div > span ~ p
    const div = new MockElement("div");
    const span = new MockElement("span");
    const p = new MockElement("p");
    
    div.children = [span, p];
    span.parentElement = div;
    p.parentElement = div;
    span.nextElementSibling = p;
    p.previousElementSibling = span;
    
    // The p element should match the complex selector
    const result = matcher!(p as any);
    expect(result).toBe(true);
  });
});

describe("Advanced CSS Selectors - Integration with HTML rendering", () => {
  it("should apply styles using advanced selectors in CSS", async () => {
    const html = `
      <html>
        <head>
          <style>
            div > p { color: #FF0000; }
            .container + .adjacent { background-color: #0FF00; }
            .first-class ~ .sibling { font-size: 20px; }
            [data-test="value"] { font-weight: bold; }
            :first-child { margin: 10px; }
          </style>
        </head>
        <body>
          <div>
            <p id="direct-child">Direct child paragraph</p>
            <span>Other element</span>
          </div>
          <div class="container">Container</div>
          <div class="adjacent">Adjacent div</div>
          <div class="first-class">First</div>
          <div class="sibling">Sibling</div>
          <span data-test="value">Data attribute element</span>
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

    // Basic test to ensure the HTML was processed without errors
    expect(layoutRoot).toBeDefined();
  });

  it("should correctly handle :nth-child(odd) and :nth-child(even)", async () => {
    const html = `
      <html>
        <head>
          <style>
            li:nth-child(odd) { color: #FF0000; }
            li:nth-child(even) { color: #000FF; }
          </style>
        </head>
        <body>
          <ul>
            <li>Item 1 (should be red)</li>
            <li>Item 2 (should be blue)</li>
            <li>Item 3 (should be red)</li>
            <li>Item 4 (should be blue)</li>
          </ul>
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

    // Basic test to ensure the HTML was processed without errors
    expect(layoutRoot).toBeDefined();
  });

  it("should handle complex attribute selectors", async () => {
    const html = `
      <html>
        <head>
          <style>
            [class*='test'] { color: #FF0000; }
            [title^='start'] { font-weight: bold; }
            [data-end$='end'] { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="mytestclass">Should be red</div>
          <p title="startofstring">Should be bold</p>
          <span data-end="myend">Should be underlined</span>
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

    // Basic test to ensure the HTML was processed without errors
    expect(layoutRoot).toBeDefined();
  });
});
