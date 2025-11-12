import { describe, expect, it } from "vitest";

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
import { createSelectorMatcher } from "../src/css/selectors/matcher.js";

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
