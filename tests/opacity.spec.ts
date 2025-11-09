import { describe, it, expect } from "vitest";
import { parseOpacity } from "../src/css/parsers/opacity-parser.js";
import type { StyleAccumulator } from "../src/css/style.js";
import { LayoutNode } from "../src/dom/node.js";
import { ComputedStyle } from "../src/css/style.js";
import { Display } from "../src/css/enums.js";
import { layoutTree } from "../src/layout/pipeline/layout-tree.js";
import { buildRenderTree } from "../src/pdf/layout-tree-builder.js";
import { renderPdf } from "../src/pdf/render.js";

describe("Opacity Parser", () => {
  it("should parse decimal opacity values correctly", () => {
    const target: StyleAccumulator = {};
    parseOpacity("0.5", target);
    expect(target.opacity).toBe(0.5);
  });

  it("should parse percentage opacity values correctly", () => {
    const target: StyleAccumulator = {};
    parseOpacity("50%", target);
    expect(target.opacity).toBe(0.5);
  });

  it("should handle opacity value of 1", () => {
    const target: StyleAccumulator = {};
    parseOpacity("1", target);
    expect(target.opacity).toBe(1);
  });

  it("should handle opacity value of 0", () => {
    const target: StyleAccumulator = {};
    parseOpacity("0", target);
    expect(target.opacity).toBe(0);
  });

  it("should clamp values above 1 to 1", () => {
    const target: StyleAccumulator = {};
    parseOpacity("1.5", target);
    expect(target.opacity).toBe(1);
  });

  it("should clamp values below 0 to 0", () => {
    const target: StyleAccumulator = {};
    parseOpacity("-0.5", target);
    expect(target.opacity).toBe(0);
  });

  it("should handle percentage values above 100%", () => {
    const target: StyleAccumulator = {};
    parseOpacity("150%", target);
    expect(target.opacity).toBe(1);
  });

  it("should handle percentage values below 0%", () => {
    const target: StyleAccumulator = {};
    parseOpacity("-25%", target);
    expect(target.opacity).toBe(0);
  });

  it("should ignore invalid values", () => {
    const target: StyleAccumulator = {};
    parseOpacity("invalid", target);
    expect(target.opacity).toBeUndefined();
  });

  it("should handle decimal values with more precision", () => {
    const target: StyleAccumulator = {};
    parseOpacity("0.75", target);
    expect(target.opacity).toBe(0.75);
  });

  it("should handle percentage values with decimal points", () => {
    const target: StyleAccumulator = {};
    parseOpacity("75.5%", target);
    expect(target.opacity).toBe(0.755);
  });
});

describe("Opacity PDF integration", () => {
  function buildOpacityLayout(opacity: number): LayoutNode {
    const root = new LayoutNode(new ComputedStyle({}));
    const block = new LayoutNode(
      new ComputedStyle({
        display: Display.Block,
        width: 100,
        height: 40,
        // Use a neutral valid style; actual fill color is irrelevant for this test.
        opacity,
      }),
    );
    root.appendChild(block);
    return root;
  }

  async function renderToPdfString(root: LayoutNode): Promise<string> {
    layoutTree(root, { width: 200, height: 200 });
    const renderable = buildRenderTree(root);
    const pdfBytes = await renderPdf(renderable);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    const pdfContent = Buffer.from(pdfBytes).toString("latin1");
    expect(pdfContent.startsWith("%PDF")).toBe(true);
    return pdfContent;
  }

  function extractExtGStates(pdf: string): string[] {
    // Heuristic extraction: find ExtGState object definitions and return their bodies.
    const matches: string[] = [];
    const regex = /[0-9]+\s+[0-9]+\s+obj\s*<<([\s\S]*?\/Type\s*\/ExtGState[\s\S]*?)>>\s*endobj/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(pdf)) !== null) {
      matches.push(m[1]);
    }
    return matches;
  }

  it("emits an ExtGState with reduced alpha for partially transparent backgrounds", async () => {
    const pdf = await renderToPdfString(buildOpacityLayout(0.5));

    const extGStates = extractExtGStates(pdf);
    // We expect at least one ExtGState dictionary to be present.
    expect(extGStates.length).toBeGreaterThan(0);

    // Check for any alpha entries typical for soft mask/opacity: /ca (non-stroking), /CA (stroking).
    const hasAlphaEntry = extGStates.some((body) =>
      /\/ca\s+0\.5\b/.test(body) || /\/CA\s+0\.5\b/.test(body),
    );

    // If this fails, opacity is not encoded at PDF level even though CSS/Style had opacity = 0.5.
    expect(hasAlphaEntry).toBe(true);
  });

  it("uses a graphics state (gs operator) referencing the ExtGState for non-1 opacity", async () => {
    const pdf = await renderToPdfString(buildOpacityLayout(0.5));

    // First, confirm an ExtGState with 0.5 alpha exists.
    const extGStates = extractExtGStates(pdf);
    const hasAlphaEntry = extGStates.some((body) =>
      /\/ca\s+0\.5\b/.test(body) || /\/CA\s+0\.5\b/.test(body),
    );
    expect(hasAlphaEntry, "An ExtGState with 0.5 alpha should be defined").toBe(true);

    // Second, confirm that a graphics state is USED.
    // This is a bit heuristic: we just check for any /GSn gs operator.
    // For this specific test, it's sufficient.
    const usesGs = /\/GS[0-9]+\s+gs/.test(pdf);
    expect(usesGs, "A graphics state should be used via the 'gs' operator").toBe(true);
  });

  it("does not emit reduced alpha ExtGState for fully opaque opacity=1", async () => {
    const pdf = await renderToPdfString(buildOpacityLayout(1));

    const extGStates = extractExtGStates(pdf);
    // If ext-gstates exist, verify none encode 0.0 & none incorrectly encode <1 alpha for this case.
    const hasWrongAlpha = extGStates.some((body) =>
      /\/ca\s+0\.[0-9]+\b/.test(body) || /\/CA\s+0\.[0-9]+\b/.test(body),
    );
    expect(hasWrongAlpha, "Opacity=1 should not create reduced-alpha ExtGState").toBe(false);
  });

  it("clamps and encodes opacity close to 0 and 1 via graphics states", async () => {
    const pdfLow = await renderToPdfString(buildOpacityLayout(0.01));
    const pdfHigh = await renderToPdfString(buildOpacityLayout(0.99));

    const extLow = extractExtGStates(pdfLow).join("\n");
    const extHigh = extractExtGStates(pdfHigh).join("\n");

    // Low opacity should not be negative or NaN; check for any ca/CA near 0.01.
    expect(/\/ca\s+0\.0?1\b/.test(extLow) || /\/CA\s+0\.0?1\b/.test(extLow)).toBe(true);

    // High opacity should be <=1; check for any ca/CA near 0.99 or 1.
    expect(/\/ca\s+0\.99\b/.test(extHigh) || /\/CA\s+0\.99\b/.test(extHigh) || /\/ca\s+1\b/.test(extHigh) || /\/CA\s+1\b/.test(extHigh)).toBe(true);
  });
});
