import path from "node:path";
import { describe, expect, it } from "vitest";
import { prepareHtmlRender, renderHtmlToPdf } from "../../src/html-to-pdf.js";
import { loadBuiltinFontConfig } from "../../src/pdf/font/builtin-fonts.js";
import { NodeEnvironment } from "../../src/environment/node-environment.js";
import { PdfDocument } from "../../src/pdf/primitives/pdf-document.js";
import { FontRegistry } from "../../src/pdf/font/font-registry.js";
import { TextFontResolver } from "../../src/pdf/renderers/text-font-resolver.js";
import type { FontConfig } from "../../src/types/fonts.js";

const ASSET_FONTS_DIR = path.resolve(process.cwd(), "assets/fonts");
const STACK = "'Selawik', 'DejaVu Sans', 'Arimo', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const STRESS_TEXT = "HTML→PDF Stress • sem JS • sem fixed/sticky";

const SELAWIK_CSS = `
@font-face {
  font-family: 'Selawik';
  src: url('ttf/selawik/selawkl.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
}
@font-face {
  font-family: 'Selawik';
  src: url('ttf/selawik/selawksl.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
}
@font-face {
  font-family: 'Selawik';
  src: url('ttf/selawik/selawk.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Selawik';
  src: url('ttf/selawik/selawksb.ttf') format('truetype');
  font-weight: 600;
  font-style: normal;
}
@font-face {
  font-family: 'Selawik';
  src: url('ttf/selawik/selawkb.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
}
body {
  font-family: ${STACK};
}
`;

function cloneFontConfig(config: FontConfig): FontConfig {
  return {
    fontFaceDefs: config.fontFaceDefs.map((face) => ({ ...face })),
    defaultStack: [...(config.defaultStack ?? [])],
  };
}

describe("Selawik opt-in integration", () => {
  it("loads Selawik from @font-face and keeps symbol fallback safe", async () => {
    const environment = new NodeEnvironment(ASSET_FONTS_DIR);
    const builtin = await loadBuiltinFontConfig(environment);
    if (!builtin) {
      throw new Error("Builtin font config is required for this test");
    }

    const fontConfig = cloneFontConfig(builtin);

    await prepareHtmlRender({
      html: `<div>${STRESS_TEXT}</div>`,
      css: SELAWIK_CSS,
      pageWidth: 794,
      pageHeight: 1123,
      viewportWidth: 794,
      viewportHeight: 1123,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      fontConfig,
      resourceBaseDir: ASSET_FONTS_DIR,
      assetRootDir: ASSET_FONTS_DIR,
      environment,
    });

    const selawikFaces = fontConfig.fontFaceDefs.filter((face) => face.family === "Selawik");
    expect(selawikFaces.length).toBeGreaterThanOrEqual(5);
    expect(selawikFaces.every((face) => face.data instanceof ArrayBuffer)).toBe(true);
    expect(selawikFaces.map((face) => face.weight)).toEqual(
      expect.arrayContaining([300, 300, 400, 600, 700]),
    );

    const registry = new FontRegistry(new PdfDocument(), { fontFaces: [] });
    await registry.initializeEmbedder(fontConfig);
    const resolver = new TextFontResolver(registry);
    const resolved = await resolver.ensureFontResource({
      fontFamily: STACK,
      fontWeight: 400,
      fontStyle: "normal",
      text: STRESS_TEXT,
    });

    const arrow = "→".codePointAt(0)!;
    const bullet = "•".codePointAt(0)!;
    expect(resolved.metrics).toBeDefined();
    expect(resolved.metrics!.cmap.getGlyphId(arrow)).toBeGreaterThan(0);
    expect(resolved.metrics!.cmap.getGlyphId(bullet)).toBeGreaterThan(0);

    const pdfBytes = await renderHtmlToPdf({
      html: `<div>${STRESS_TEXT}</div>`,
      css: SELAWIK_CSS,
      pageWidth: 794,
      pageHeight: 1123,
      viewportWidth: 794,
      viewportHeight: 1123,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      resourceBaseDir: ASSET_FONTS_DIR,
      assetRootDir: ASSET_FONTS_DIR,
      environment,
    });

    expect(pdfBytes.byteLength).toBeGreaterThan(1024);
  });
});
