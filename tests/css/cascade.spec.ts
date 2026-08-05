import { applyOrderedDeclarationsToStyle } from "../../src/css/apply-declarations.js";
import {
  resolveDeclarationsForElement,
  type ResolvedDeclarationsResult,
} from "../../src/css/compute-style/declarations.js";
import type { DomLikeElement } from "../../src/css/selectors/matcher.js";
import type { StyleAccumulator } from "../../src/css/style.js";
import { buildCssRules } from "../../src/html/css/parse-css.js";
import { makeUnitParsers } from "../../src/units/units.js";

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

function resolveResult(css: string, element: DomLikeElement): ResolvedDeclarationsResult {
  const rules = buildCssRules(css).styleRules;
  return resolveDeclarationsForElement(element, rules);
}

function resolve(css: string, element: DomLikeElement): Record<string, string> {
  return resolveResult(css, element).resolvedDeclarations;
}

function apply(css: string, element: DomLikeElement): StyleAccumulator {
  const result = resolveResult(css, element);
  const target: StyleAccumulator = {};
  applyOrderedDeclarationsToStyle(
    result.orderedDeclarations,
    target,
    makeUnitParsers({ viewport: { width: 800, height: 600 } }),
  );
  return target;
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

  it("preserves duplicate declarations so the last valid value can win", () => {
    const element = createElement({ classes: ["card"] });
    const result = resolveResult(
      ".card { color: red; color: blue; }",
      element,
    );

    expect(
      result.orderedDeclarations
        .filter((declaration) => declaration.property === "color")
        .map((declaration) => declaration.value),
    ).toEqual(["red", "blue"]);
    expect(result.resolvedDeclarations.color).toBe("blue");
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

  it("preserves longhand then shorthand order inside one rule", () => {
    const element = createElement({ classes: ["card"] });
    const style = apply(
      ".card { margin-left: 5px; margin: 20px; }",
      element,
    );

    expect(style.marginLeft).toBe(20);
  });

  it("lets a more specific shorthand override a later less-specific longhand", () => {
    const element = createElement({ id: "target" });
    const style = apply(
      "#target { margin: 20px; } div { margin-left: 5px; }",
      element,
    );

    expect(style.marginLeft).toBe(20);
  });

  it("lets a more specific longhand override a later less-specific shorthand", () => {
    const element = createElement({ id: "target" });
    const style = apply(
      "#target { margin-left: 5px; } div { margin: 20px; }",
      element,
    );

    expect(style.marginLeft).toBe(5);
  });
});
