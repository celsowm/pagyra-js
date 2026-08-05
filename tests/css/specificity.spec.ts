import { computeSpecificity } from "../../src/css/selectors/specificity.js";

describe("CSS selector specificity", () => {
  it("counts type, class and ID selectors", () => {
    expect(computeSpecificity("div")).toEqual([0, 0, 1]);
    expect(computeSpecificity(".card")).toEqual([0, 1, 0]);
    expect(computeSpecificity("#target")).toEqual([1, 0, 0]);
  });

  it("counts compound selectors", () => {
    expect(
      computeSpecificity("article.card[data-kind]:first-child"),
    ).toEqual([0, 3, 1]);
  });

  it("adds the specificity of :not arguments without counting :not itself", () => {
    expect(computeSpecificity(":not(#disabled).card")).toEqual([1, 1, 0]);
  });

  it("counts selectors across combinators", () => {
    expect(computeSpecificity("main > #target .card span")).toEqual([1, 1, 2]);
  });

  it("counts pseudo-elements as type selectors", () => {
    expect(computeSpecificity("div::before")).toEqual([0, 0, 2]);
  });
});
