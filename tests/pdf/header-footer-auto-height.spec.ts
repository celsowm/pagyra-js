import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../../src/html-to-pdf.js";
import type { RenderBox } from "../../src/pdf/types.js";

const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8/5+hHgAHggJ/P95syQAAAABJRU5ErkJggg==";

function firstTextBaselineY(root: RenderBox): number {
  const stack: RenderBox[] = [root];
  while (stack.length > 0) {
    const box = stack.pop()!;
    for (const run of box.textRuns) {
      if (run.text.trim().length > 0 && run.lineMatrix) {
        return run.lineMatrix.f;
      }
    }
    for (let i = box.children.length - 1; i >= 0; i--) {
      stack.push(box.children[i]);
    }
  }
  throw new Error("No text runs found in render tree");
}

describe("header/footer auto max height", () => {
  const html = "<p>Conteudo principal para validacao</p>";
  const headerHtml = `<img src="data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}" alt="h" style="display:block;height:88px;width:88px;" />`;

  it("auto-reserves header space from rendered height when maxHeaderHeightPx is omitted", async () => {
    const baseRender = await prepareHtmlRender({
      html,
      viewportWidth: 794,
      viewportHeight: 1123,
      pageWidth: 794,
      pageHeight: 1123,
      margins: { top: 96, right: 96, bottom: 96, left: 96 },
    });

    const autoRender = await prepareHtmlRender({
      html,
      viewportWidth: 794,
      viewportHeight: 1123,
      pageWidth: 794,
      pageHeight: 1123,
      margins: { top: 96, right: 96, bottom: 96, left: 96 },
      headerFooter: {
        headerHtml,
      },
    });

    const baseY = firstTextBaselineY(baseRender.renderTree.root);
    const autoY = firstTextBaselineY(autoRender.renderTree.root);

    expect(autoRender.renderTree.hf.maxHeaderHeightPx).toBeGreaterThanOrEqual(88);
    expect(autoY - baseY).toBeGreaterThanOrEqual(70);
  });

  it("keeps explicit maxHeaderHeightPx unchanged", async () => {
    const explicitRender = await prepareHtmlRender({
      html,
      viewportWidth: 794,
      viewportHeight: 1123,
      pageWidth: 794,
      pageHeight: 1123,
      margins: { top: 96, right: 96, bottom: 96, left: 96 },
      headerFooter: {
        headerHtml,
        maxHeaderHeightPx: 0,
      },
    });

    expect(explicitRender.renderTree.hf.maxHeaderHeightPx).toBe(0);
  });
});
