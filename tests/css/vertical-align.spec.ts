import { ComputedStyle } from "../../src/css/style.js";
import { computeStyleForElement } from "../../src/css/compute-style.js";
import { makeUnitParsers } from "../../src/units/units.js";
import type { DomElement } from "../../src/types/core.js";
import { collectRuns, renderTreeForHtml } from "../helpers/render-utils.js";

function makeElement(inlineStyle: string): DomElement {
  return {
    nodeType: 1,
    nodeName: "SPAN",
    tagName: "span",
    getAttribute(name: string) {
      return name === "style" ? inlineStyle : null;
    },
    hasAttribute(name: string) {
      return name === "style";
    },
    querySelectorAll() {
      return [];
    },
    parentElement: null,
    firstElementChild: null,
    lastElementChild: null,
    nextElementSibling: null,
    previousElementSibling: null,
  };
}

describe("vertical-align", () => {
  it("parses keyword and numeric values into computed styles", () => {
    const units = makeUnitParsers({ viewport: { width: 800, height: 600 } });
    const keyword = computeStyleForElement(makeElement("vertical-align: super;"), [], new ComputedStyle(), units, 16);
    const length = computeStyleForElement(makeElement("vertical-align: 6px;"), [], new ComputedStyle(), units, 16);
    const percentage = computeStyleForElement(makeElement("vertical-align: 25%;"), [], new ComputedStyle(), units, 16);

    expect(keyword.verticalAlign).toBe("super");
    expect(length.verticalAlign).toBe("6px");
    expect(percentage.verticalAlign).toBe("25%");
  });

  it("raises superscript and lowers subscript relative to the shared baseline", async () => {
    const renderTree = await renderTreeForHtml(
      '<p style="font-size: 20px; line-height: 30px"><span style="vertical-align: super">SUPER</span><span>BASE</span><span style="vertical-align: sub">SUB</span></p>',
    );
    const runs = collectRuns(renderTree.root);
    const superRun = runs.find((run) => run.text === "SUPER");
    const baseRun = runs.find((run) => run.text === "BASE");
    const subRun = runs.find((run) => run.text === "SUB");

    expect(superRun).toBeDefined();
    expect(baseRun).toBeDefined();
    expect(subRun).toBeDefined();

    const superBaseline = superRun?.lineMatrix?.f ?? 0;
    const baseBaseline = baseRun?.lineMatrix?.f ?? 0;
    const subBaseline = subRun?.lineMatrix?.f ?? 0;
    expect(superBaseline).toBeLessThan(baseBaseline);
    expect(subBaseline).toBeGreaterThan(baseBaseline);
  });

  it("uses positive lengths to raise inline content", async () => {
    const renderTree = await renderTreeForHtml(
      '<p style="font-size: 20px; line-height: 30px"><span style="vertical-align: 6px">RAISED</span><span>BASE</span></p>',
    );
    const runs = collectRuns(renderTree.root);
    const raised = runs.find((run) => run.text === "RAISED");
    const base = runs.find((run) => run.text === "BASE");

    expect(raised).toBeDefined();
    expect(base).toBeDefined();
    const raisedBaseline = raised?.lineMatrix?.f ?? 0;
    const baseBaseline = base?.lineMatrix?.f ?? 0;
    expect(baseBaseline - raisedBaseline).toBeCloseTo(6, 4);
  });
});
