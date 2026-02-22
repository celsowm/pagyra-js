import { parseHTML } from "linkedom";

import { ComputedStyle } from "../../src/css/style.js";
import { buildCssRules } from "../../src/html/css/parse-css.js";
import { synthesizePseudoElement } from "../../src/html/dom-converter/pseudo-elements.js";
import type { ConversionContext } from "../../src/html/image-converter.js";
import { makeUnitParsers } from "../../src/units/units.js";

function createTestContext(): ConversionContext {
  return {
    resourceBaseDir: "",
    assetRootDir: "",
    units: makeUnitParsers({ viewport: { width: 800, height: 600 } }),
    rootFontSize: 16,
  };
}

describe("dom-converter/pseudo-elements", () => {
  it("synthesizes a pseudo element with generated text content", async () => {
    const { document } = parseHTML(`<div id="host" data-label="Alpha"></div>`);
    const element = document.querySelector("#host");
    const cssRules = buildCssRules(`#host::before { content: "X"; }`).styleRules;

    const result = await synthesizePseudoElement(
      element as unknown as import("../../src/html/css/parse-css.js").DomEl,
      "::before",
      cssRules,
      new ComputedStyle(),
      createTestContext(),
      null,
    );

    expect(result).not.toBeNull();
    expect(result?.tagName).toBe("::before");
    expect(result?.customData).toMatchObject({ pseudoType: "before" });
    expect(result?.children).toHaveLength(1);
    expect(result?.children[0]?.textContent).toBe("X");
  });

  it("returns null when the pseudo style has no content", async () => {
    const { document } = parseHTML(`<div id="host"></div>`);
    const element = document.querySelector("#host");
    const cssRules = buildCssRules(`#host { color: red; }`).styleRules;

    const result = await synthesizePseudoElement(
      element as unknown as import("../../src/html/css/parse-css.js").DomEl,
      "::after",
      cssRules,
      new ComputedStyle(),
      createTestContext(),
      null,
    );

    expect(result).toBeNull();
  });
});
