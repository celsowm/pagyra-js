import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import type { RenderBox, Run } from "../src/pdf/types.js";
import { PdfDocument } from "../src/pdf/primitives/pdf-document.js";
import { FontRegistry } from "../src/pdf/font/font-registry.js";
import { ComputedStyle } from "../src/css/style.js";
import { estimateLineWidth } from "../src/layout/utils/text-metrics.js";

function collectRuns(box: RenderBox): Run[] {
  const runs: Run[] = [...box.textRuns];
  for (const child of box.children) {
    runs.push(...collectRuns(child));
  }
  return runs;
}

async function renderRuns(html: string, css = ""): Promise<Run[]> {
  const wrappedHtml = /<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`;
  const { renderTree } = await prepareHtmlRender({
    html: wrappedHtml,
    css,
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 800,
    pageHeight: 600,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  return collectRuns(renderTree.root);
}

describe("bold text support", () => {
  it("propagates <strong> weight into render runs", async () => {
    const runs = await renderRuns("<p>Normal <strong>Bold</strong> text</p>");
    const hasBoldRun = runs.some((run) => run.fontWeight === 700 && run.text.includes("Bold"));
    const hasNormalRun = runs.some((run) => (run.fontWeight ?? 0) === 400 && run.text.includes("Normal"));

    expect(hasBoldRun).toBe(true);
    expect(hasNormalRun).toBe(true);
  });

  it("propagates <b> weight into render runs", async () => {
    const runs = await renderRuns("<p>Normal <b>Bold</b> text</p>");
    const boldRun = runs.find((run) => run.text.includes("Bold"));
    const normalRun = runs.find((run) => run.text.includes("Normal"));

    expect(boldRun?.fontWeight).toBe(700);
    expect((normalRun?.fontWeight ?? 0)).toBe(400);
  });

  it("parses numeric and keyword font-weight declarations", async () => {
    const html = `
      <p>
        <span style="font-weight: bold">Heavy</span>
        <span style="font-weight: 300">Light</span>
      </p>
    `;
    const runs = await renderRuns(html);
    const heavy = runs.find((run) => run.text.includes("Heavy"));
    const light = runs.find((run) => run.text.includes("Light"));

    expect(heavy?.fontWeight).toBe(700);
    expect(light?.fontWeight).toBe(300);
  });

  it("honours relative font-weight values", async () => {
    const html = `
      <div style="font-weight: 300">
        <span style="font-weight: bolder">Step Up</span>
        <span style="font-weight: lighter">Step Down</span>
      </div>
    `;
    const runs = await renderRuns(html);
    const up = runs.find((run) => run.text.includes("Step Up"));
    const down = runs.find((run) => run.text.includes("Step Down"));

    expect(up?.fontWeight).toBe(400);
    expect(down?.fontWeight).toBe(200);
  });

  it("applies UA default bold weight to table headers", async () => {
    const runs = await renderRuns("<table><tr><th>Head</th><td>Body</td></tr></table>");
    const thRun = runs.find((run) => run.text.includes("Head"));
    const tdRun = runs.find((run) => run.text.includes("Body"));

    expect(thRun?.fontWeight).toBe(700);
    expect((tdRun?.fontWeight ?? 400)).toBe(400);
  });

  it("selects bold base14 variants when requested", () => {
    const doc = new PdfDocument();
    const registry = new FontRegistry(doc, { fontFaces: [] });

    const normal = registry.ensureFontResourceSync("Times New Roman", 400);
    const bold = registry.ensureFontResourceSync("Times New Roman", 700);

    expect(normal.baseFont).toBe("Times-Roman");
    expect(bold.baseFont).toBe("Times-Bold");
  });

  it("estimates bold text as wider than regular weight", () => {
    const normalStyle = new ComputedStyle({ fontWeight: 400, fontSize: 16 });
    const boldStyle = new ComputedStyle({ fontWeight: 700, fontSize: 16 });

    const sample = "Weight";
    expect(estimateLineWidth(sample, boldStyle)).toBeGreaterThan(estimateLineWidth(sample, normalStyle));
  });
});

describe("text decorations", () => {
  it("marks <s> runs as line-through", async () => {
    const runs = await renderRuns("<p><s>Removed</s> text</p>");
    const strikeRun = runs.find((run) => run.text.includes("Removed"));
    const plainRun = runs.find((run) => run.text.includes("text"));

    expect(strikeRun?.decorations?.lineThrough).toBe(true);
    expect((strikeRun?.advanceWidth ?? 0)).toBeGreaterThan(0);
    expect(plainRun?.decorations?.lineThrough ?? false).toBe(false);
  });

  it("allows overriding strikethrough via CSS", async () => {
    const runs = await renderRuns("<p><s style=\"text-decoration: none\">Visible</s></p>");
    const run = runs.find((candidate) => candidate.text.includes("Visible"));

    expect(run?.decorations?.lineThrough ?? false).toBe(false);
  });
});
