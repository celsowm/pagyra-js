import { buildCssRules } from "../../src/html/css/parse-css.js";

describe("parse-css pseudo-element rules", () => {
  it("keeps terminal ::before selectors and matches the host element", () => {
    const css = ".item::before { content: 'x'; color: red; }";
    const parsed = buildCssRules(css);

    expect(parsed.styleRules).toHaveLength(1);
    const rule = parsed.styleRules[0];
    expect(rule.pseudoElement).toBe("::before");

    const fakeEl = {
      tagName: "div",
      id: "",
      classList: {
        contains: (cls: string) => cls === "item",
      } as unknown as DOMTokenList,
      parentElement: null,
      firstElementChild: null,
      lastElementChild: null,
      nextElementSibling: null,
      previousElementSibling: null,
      ownerDocument: undefined,
      textContent: "",
      getAttribute: (name: string) => (name === "class" ? "item" : null),
    };

    expect(rule.match(fakeEl)).toBe(true);
  });
});
