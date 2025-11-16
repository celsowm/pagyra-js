import { describe, it, expect } from "vitest";
import {
  initHeaderFooterContext,
  layoutHeaderFooterTrees,
  adjustPageBoxForHf,
  pickHeaderVariant,
  pickFooterVariant,
} from "../../src/pdf/header-footer-layout.js";
import { LayerMode } from "../../src/pdf/types.js";

const pxToPt = (px: number) => px * 0.75;

describe("header-footer-layout", () => {
  it("computes layout heights and adjusts page box", () => {
    const hf = {
      headerHtml: "Default header",
      headerFirstHtml: "First header",
      footerHtml: "Footer",
      footerEvenHtml: "Even footer",
      layerMode: LayerMode.Over,
      clipOverflow: true,
      maxHeaderHeightPx: 40,
      maxFooterHeightPx: 30,
      placeholders: {},
    };

    const ctx = initHeaderFooterContext(hf, { widthPt: 600, heightPt: 800 }, { x: 0, y: 0, width: 500, height: 700 });
    const layout = layoutHeaderFooterTrees(ctx, pxToPt);

    expect(layout.headerHeightPt).toBeCloseTo(30);
    expect(layout.footerHeightPt).toBeCloseTo(22.5);
    expect(layout.layerMode).toBe(LayerMode.Over);

    const adjusted = adjustPageBoxForHf(ctx.baseBox, layout);
    expect(adjusted.y).toBe(40);
    expect(adjusted.height).toBe(700 - 40 - 30);
  });

  it("selects correct header/footer variant based on page index", () => {
    const hf = {
      headerHtml: "Fallback header",
      headerFirstHtml: "First header",
      footerHtml: "Fallback footer",
      footerEvenHtml: "Even footer",
      layerMode: LayerMode.Under,
      clipOverflow: false,
      maxHeaderHeightPx: 20,
      maxFooterHeightPx: 20,
      placeholders: {},
    };
    const layout = layoutHeaderFooterTrees(
      initHeaderFooterContext(hf, { widthPt: 600, heightPt: 800 }, { x: 0, y: 0, width: 400, height: 600 }),
      pxToPt,
    );

    expect(pickHeaderVariant(layout, 1, 3)?.content).toBe("First header");
    expect(pickHeaderVariant(layout, 2, 3)?.content).toBe("Fallback header");
    expect(pickFooterVariant(layout, 2, 3)?.content).toBe("Even footer");
    expect(pickFooterVariant(layout, 3, 3)?.content).toBe("Fallback footer");
  });
});
