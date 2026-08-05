import { resolveDeclarationsForElement } from "../../src/css/compute-style/declarations.js";
import type { DomLikeElement } from "../../src/css/selectors/matcher.js";
import { buildCssRules } from "../../src/html/css/parse-css.js";

type FakeElementOptions = {
  tagName?: string;
  id?: string;
  classes?: string[];
  style?: string;
};

function createElement(options: FakeElementOptions = {}): DomLikeElement {
  const classes = options.classes ?? [];
  return {
    tagName: options.tagName ?? "div",
    id: options.id,
    classList: {
      contains: (className: string) => classes.includes(className),
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
      if (name === "style") return options.style ?? null;
      return null;
    },
  };
}

function resolve(css: string, element: DomLikeElement): Record<string, string> {
  const rules = buildCssRules(css).styleRules;
  return resolveDeclarationsForElement(element, rules).resolvedDeclarations;
}

describe("CSS cascade precedence", () => {
  it("prefers a more specific selector even when it appears earlier", () => {
    const element = createElement({ id: "target" });
    const declarations = resolve(
      "#target { color: red; } div { color: blue; }",
      element,
    );

    expect(declarations.color).toBe("red");
  });

  it("uses source order when selectors have equal specificity", () => {
    const element = createElement({ classes: ["card"] });
    const declarations = resolve(
      ".card { color: red; } .card { color: blue; }",
      element,
    );

    expect(declarations.color).toBe("blue");
  });

  it("lets an important author declaration beat a normal inline declaration", () => {
    const element = createElement({
      classes: ["card"],
      style: "color: blue",
    });
    const declarations = resolve(
      ".card { color: red !important; }",
      element,
    );

    expect(declarations.color).toBe("red");
  });

  it("lets an important inline declaration beat an important author declaration", () => {
    const element = createElement({
      classes: ["card"],
      style: "color: blue !important",
    });
    const declarations = resolve(
      ".card { color: red !important; }",
      element,
    );

    expect(declarations.color).toBe("blue");
  });

  it("applies cascade precedence to custom properties before var resolution", () => {
    const element = createElement({ id: "target" });
    const declarations = resolve(
      "#target { --accent: red; color: var(--accent); } div { --accent: blue; }",
      element,
    );

    expect(declarations.color).toBe("red");
  });
});
