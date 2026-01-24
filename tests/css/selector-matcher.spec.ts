import { createSelectorMatcher, type DomLikeElement } from "../../src/css/selectors/matcher.js";
import { parseSelector } from "../../src/css/selectors/parser.js";

type FakeElementOptions = {
  tagName?: string;
  id?: string;
  classes?: string[];
};

function createElement(options: FakeElementOptions = {}): DomLikeElement {
  const classes = options.classes ?? [];
  return {
    tagName: options.tagName ?? "div",
    id: options.id,
    classList: {
      contains: (cls: string) => classes.includes(cls),
    } as unknown as DOMTokenList,
    parentElement: null,
    firstElementChild: null,
    lastElementChild: null,
    nextElementSibling: null,
    previousElementSibling: null,
    ownerDocument: undefined,
    textContent: null,
    getAttribute: (name: string) => {
      if (name === "id") return options.id ?? null;
      if (name === "class") return classes.join(" ");
      return null;
    },
  };
}

describe("selector parsing for hyphenated identifiers", () => {
  it("parses class selectors with hyphens", () => {
    const parsed = parseSelector(".form-grid");
    expect(parsed).not.toBeNull();
    expect(parsed?.[0].simple.classes).toEqual(["form-grid"]);
  });

  it("parses id selectors with hyphens", () => {
    const parsed = parseSelector("#main-content");
    expect(parsed).not.toBeNull();
    expect(parsed?.[0].simple.id).toBe("main-content");
  });
});

describe("selector matching for hyphenated classes", () => {
  it("matches only elements with the class", () => {
    const matcher = createSelectorMatcher(".form-grid");
    expect(matcher).not.toBeNull();
    if (!matcher) return;

    const withClass = createElement({ classes: ["form-grid"] });
    const withoutClass = createElement({ classes: ["form-row"] });

    expect(matcher(withClass)).toBe(true);
    expect(matcher(withoutClass)).toBe(false);
  });
});
