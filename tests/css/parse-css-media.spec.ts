import {
  buildCssRules,
  type CssParseOptions,
} from "../../src/html/css/parse-css.js";

function colorsForCard(css: string, options?: CssParseOptions): string[] {
  return buildCssRules(css, options).styleRules
    .filter((rule) => rule.selector === ".card")
    .map((rule) => rule.declarations.color)
    .filter((color): color is string => color !== undefined);
}

describe("CSS media query parsing", () => {
  it("includes print rules and excludes screen rules by default", () => {
    const colors = colorsForCard(`
      .card { color: black; }
      @media screen { .card { color: blue; } }
      @media print { .card { color: red; } }
    `);

    expect(colors).toEqual(["black", "red"]);
  });

  it("can explicitly evaluate screen media", () => {
    const colors = colorsForCard(`
      @media print { .card { color: red; } }
      @media screen { .card { color: blue; } }
    `, { mediaType: "screen" });

    expect(colors).toEqual(["blue"]);
  });

  it("supports all, not and comma-separated query lists", () => {
    const colors = colorsForCard(`
      @media all { .card { color: black; } }
      @media not screen { .card { color: red; } }
      @media screen, print { .card { color: green; } }
    `);

    expect(colors).toEqual(["black", "red", "green"]);
  });

  it("preserves source order around matching media blocks", () => {
    const rules = buildCssRules(`
      .card { color: black; }
      @media print { .card { color: red; } }
      .card { color: green; }
    `).styleRules;

    expect(rules.map((rule) => rule.sourceOrder)).toEqual([0, 1, 2]);
    expect(rules.map((rule) => rule.declarations.color)).toEqual(["black", "red", "green"]);
  });

  it("evaluates dimensions and orientation against the render viewport", () => {
    const colors = colorsForCard(`
      @media print and (min-width: 700px) { .card { color: red; } }
      @media print and (max-width: 600px) { .card { color: blue; } }
      @media print and (orientation: landscape) { .card { color: green; } }
      @media print and (orientation: portrait) { .card { color: purple; } }
    `, {
      mediaType: "print",
      viewportWidth: 800,
      viewportHeight: 600,
    });

    expect(colors).toEqual(["red", "green"]);
  });

  it("supports physical length units in media features", () => {
    const colors = colorsForCard(`
      @media print and (min-width: 7in) { .card { color: red; } }
      @media print and (max-width: 150mm) { .card { color: blue; } }
    `, {
      viewportWidth: 700,
      viewportHeight: 900,
    });

    expect(colors).toEqual(["red"]);
  });

  it("excludes unsupported media features instead of applying them accidentally", () => {
    const colors = colorsForCard(`
      @media print and (prefers-color-scheme: dark) {
        .card { color: white; }
      }
    `, {
      viewportWidth: 800,
      viewportHeight: 600,
    });

    expect(colors).toEqual([]);
  });
});
