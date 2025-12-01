import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { prepareHtmlRender } from "../../src/html-to-pdf.js";
import type { RenderBox, Run } from "../../src/pdf/types.js";
import { PdfDocument } from "../../src/pdf/primitives/pdf-document.js";
import { initFontSystem } from "../../src/pdf/font/font-registry.js";
import { loadBuiltinFontConfig } from "../../src/pdf/font/builtin-fonts.js";
import { FontRegistryResolver } from "../../src/fonts/font-registry-resolver.js";
import { computeGlyphRun, applyWordSpacingToGlyphRun } from "../../src/pdf/utils/node-text-run-factory.js";

type TextAlign = "left" | "right" | "center" | "justify";
type Direction = "ltr" | "rtl";

interface BrowserConfig {
  text: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  direction: Direction;
  textAlign: TextAlign;
  containerWidth: number;
  viewportHeight: number;
}

interface CompareOptions {
  text: string;
  fontFamily: string;
  fontSize: number;
  textAlign: TextAlign;
  direction: Direction;
  lineHeight: number;
  containerWidth: number;
  viewportHeight: number;
  pageHeight: number;
}

interface GlyphEntry {
  char: string;
  width: number;
  height: number;
  x: number;
  y: number;
  line: number;
}

interface BrowserMeasurement {
  glyphs: GlyphEntry[];
  lines: BrowserLine[];
}

interface BrowserLine {
  line: number;
  width: number;
  x: number;
  y: number;
}

interface PdfMeasurement {
  glyphs: GlyphEntry[];
  lines: PdfLineSummary[];
}

interface PdfLineSummary {
  line: number;
  width: number;
  start: number;
  end: number;
}

const DEFAULT_TEXT =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. " +
  "Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor. " +
  "Cras elementum ultrices diam. Maecenas ligula massa, varius a, semper congue, euismod non, mi.";

const DEFAULT_CONFIG: Omit<CompareOptions, "text"> = {
  fontFamily: "'Tinos', Georgia, 'Times New Roman', serif",
  fontSize: 16,
  textAlign: "justify",
  direction: "ltr",
  lineHeight: 1.5,
  containerWidth: 480,
  viewportHeight: 900,
  pageHeight: 900,
};

async function main() {
  const options = await resolveOptions();
  console.log(`Running glyph comparison for text (${options.text.length} characters)`);
  console.log(
    `Font: ${options.fontFamily} @ ${options.fontSize}px, align=${options.textAlign}, direction=${options.direction}, width=${options.containerWidth}px`,
  );

  const browserMetrics = await captureBrowserMeasurement(options);
  const pdfMetrics = await capturePdfMeasurement(options);

  reportComparison(browserMetrics, pdfMetrics);
}

// ----------------------------------------
// Browser measurement via injected script
// ----------------------------------------

async function captureBrowserMeasurement(options: CompareOptions): Promise<BrowserMeasurement> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: options.containerWidth + 120, height: options.viewportHeight },
    });
    await page.setContent("<!doctype html><html><head><meta charset='utf-8'/><title>glyph debug</title></head><body></body></html>", {
      waitUntil: "domcontentloaded",
    });

    const browserMeasurementScript = `
      return (async function(cfg) {
        const container = document.createElement("div");
        container.id = "glyph-debug-container";
        Object.assign(container.style, {
          position: "absolute",
          top: "0",
          left: "0",
          width: cfg.containerWidth + "px",
          fontFamily: cfg.fontFamily,
          fontSize: cfg.fontSize + "px",
          lineHeight: cfg.lineHeight + "",
          textAlign: cfg.textAlign,
          direction: cfg.direction,
          color: "black",
          backgroundColor: "white",
          visibility: "hidden",
          whiteSpace: "normal",
          wordWrap: "break-word",
          maxWidth: cfg.containerWidth + "px",
        });
        container.dir = cfg.direction;
        container.textContent = cfg.text;
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.appendChild(container);
        await (document.fonts?.ready ?? Promise.resolve());

        const RectStrategies = {
          widest: (rects) => {
            if (!rects.length) return null;
            let chosen = rects[0];
            for (let i = 1; i < rects.length; i++) {
              if (rects[i].width > chosen.width) {
                chosen = rects[i];
              }
            }
            return [chosen];
          },
          first: (rects) => (rects.length ? [rects[0]] : null),
          largest: (rects) => {
            if (!rects.length) return null;
            let chosen = rects[0];
            let maxArea = chosen.width * chosen.height;
            for (let i = 1; i < rects.length; i++) {
              const area = rects[i].width * rects[i].height;
              if (area > maxArea) {
                chosen = rects[i];
                maxArea = area;
              }
            }
            return [chosen];
          },
          union: (rects) => {
            if (!rects.length) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (let i = 0; i < rects.length; i++) {
              const r = rects[i];
              minX = Math.min(minX, r.left);
              minY = Math.min(minY, r.top);
              maxX = Math.max(maxX, r.right);
              maxY = Math.max(maxY, r.bottom);
            }
            return [
              {
                left: minX,
                top: minY,
                right: maxX,
                bottom: maxY,
                width: maxX - minX,
                height: maxY - minY,
                x: minX,
                y: minY,
              },
            ];
          },
          all: (rects) => (rects.length ? Array.from(rects) : null),
        };

        const ThresholdStrategies = {
          manual: (_glyphs, manualValue) => ({ threshold: manualValue, method: "manual" }),
          auto: (_glyphs, _manual, paragraph) => {
            const style = window.getComputedStyle(paragraph);
            const lineHeight = parseFloat(style.lineHeight);
            const fontSize = parseFloat(style.fontSize);
            const effectiveLineHeight = Number.isNaN(lineHeight) ? fontSize * 1.2 : lineHeight;
            return { threshold: Math.max(1, effectiveLineHeight * 0.3), method: "auto" };
          },
          adaptive: () => ({ threshold: 5, method: "adaptive" }),
        };

        function getTextNodes(root) {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
          const nodes = [];
          while (walker.nextNode()) nodes.push(walker.currentNode);
          return nodes;
        }

        function segmentText(text) {
          if (window.Intl?.Segmenter) {
            const seg = new window.Intl.Segmenter(undefined, { granularity: "grapheme" });
            return Array.from(seg.segment(text)).map((s) => ({
              segment: s.segment,
              start: s.index,
              end: s.index + s.segment.length,
            }));
          }
          return text.split("").map((ch, i) => ({ segment: ch, start: i, end: i + 1 }));
        }

        function formatNumber(value, precision) {
          if (precision === "full") return value;
          if (precision === "integer") return Math.round(value);
          return Math.round(value * 100) / 100;
        }

        function isRTL(element) {
          return window.getComputedStyle(element).direction === "rtl";
        }

        function debugJustifiedParagraph(paragraph, opts) {
          const textNodes = getTextNodes(paragraph);
          const range = document.createRange();
          const glyphs = [];
          const paraRect = paragraph.getBoundingClientRect();
          const rtl = isRTL(paragraph);

          textNodes.forEach((node) => {
            const value = node.nodeValue || "";
            const segments = segmentText(value);

            segments.forEach((segment) => {
              range.setStart(node, segment.start);
              range.setEnd(node, segment.end);
              const rects = range.getClientRects();
              if (!rects.length) return;

              const strategy = RectStrategies[opts.rectStrategy] || RectStrategies.widest;
              const selected = strategy(rects);
              if (!selected || !selected.length) return;
              const chosen = selected[0];

              let x = chosen.left;
              let y = chosen.top;
              if (opts.coordMode === "relative") {
                x -= paraRect.left;
                y -= paraRect.top;
              }

              glyphs.push({
                char: segment.segment,
                width: formatNumber(chosen.width, opts.precision),
                height: formatNumber(chosen.height, opts.precision),
                x: formatNumber(x, opts.precision),
                y: formatNumber(y, opts.precision),
                line: 0,
                _rawY: chosen.top,
              });
            });
          });

          if (!glyphs.length) {
            range.detach?.();
            return { glyphs: [], lines: [] };
          }

          const thresholdResult = ThresholdStrategies[opts.thresholdMode](glyphs, opts.lineThreshold, paragraph);
          const threshold = thresholdResult.threshold ?? opts.lineThreshold;

          glyphs.sort((a, b) => {
            const diffY = a._rawY - b._rawY;
            if (Math.abs(diffY) > 1) return diffY;
            return rtl ? b.x - a.x : a.x - b.x;
          });

          let currentLine = 0;
          let currentTop = glyphs[0]._rawY;
          glyphs.forEach((glyph) => {
            if (Math.abs(glyph._rawY - currentTop) > threshold) {
              currentLine++;
              currentTop = glyph._rawY;
            }
            glyph.line = currentLine;
            delete glyph._rawY;
          });

          const byLine = new Map();
          glyphs.forEach((glyph) => {
            const list = byLine.get(glyph.line) || [];
            list.push(glyph);
            byLine.set(glyph.line, list);
          });

          const lines = [];
          byLine.forEach((items, line) => {
            items.sort((a, b) => (rtl ? b.x - a.x : a.x - b.x));
            const first = items[0];
            const last = items[items.length - 1];
            const width = Math.max(0, last.x + last.width - first.x);
            lines.push({
              line,
              width,
              x: first.x,
              y: first.y,
            });
          });

          range.detach?.();
          return { glyphs, lines };
        }

        const measurement = debugJustifiedParagraph(container, {
          rectStrategy: "widest",
          coordMode: "relative",
          precision: "full",
          thresholdMode: "auto",
          lineThreshold: 2,
        });

        container.remove();
        return measurement;
      })(cfg);
    `;

    const pageFunction = new Function("cfg", browserMeasurementScript) as (cfg: BrowserConfig) => Promise<BrowserMeasurement>;
    const config: BrowserConfig = {
      text: options.text,
      fontFamily: options.fontFamily,
      fontSize: options.fontSize,
      lineHeight: options.lineHeight,
      direction: options.direction,
      textAlign: options.textAlign,
      containerWidth: options.containerWidth,
      viewportHeight: options.viewportHeight,
    };
    const result = await page.evaluate(pageFunction, config);

    return result;
  } finally {
    await browser.close();
  }
}

// ----------------------------------------
// PDF measurement via render pipeline
// ----------------------------------------

async function capturePdfMeasurement(options: CompareOptions): Promise<PdfMeasurement> {
  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          html, body {
            margin: 0;
            padding: 0;
          }
          body {
            font-family: ${options.fontFamily};
            font-size: ${options.fontSize}px;
            line-height: ${options.lineHeight};
          }
          .wrapper {
            width: ${options.containerWidth}px;
          }
          .wrapper p {
            margin: 0;
            text-align: ${options.textAlign};
            font-size: ${options.fontSize}px;
            line-height: ${options.lineHeight};
          }
        </style>
      </head>
      <body dir="${options.direction}">
        <div class="wrapper">
          <p id="text" dir="${options.direction}">${escapeHtml(options.text)}</p>
        </div>
      </body>
    </html>`;

  const prepared = await prepareHtmlRender({
    html,
    css: "",
    viewportWidth: options.containerWidth,
    viewportHeight: options.viewportHeight,
    pageWidth: options.containerWidth,
    pageHeight: options.pageHeight,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const fontConfig = await loadBuiltinFontConfig();
  const doc = new PdfDocument();
  const fontRegistry = initFontSystem(doc, prepared.renderTree.css);
  if (fontConfig) {
    await fontRegistry.initializeEmbedder(fontConfig);
  }
  const fontResolver = new FontRegistryResolver(fontRegistry);
  await enrichTreeWithGlyphRuns(prepared.renderTree.root, fontResolver);

  const runs = collectRuns(prepared.renderTree.root);
  const glyphs = runs.flatMap(convertRunToGlyphEntries);
  const lines = summarizePdfLines(glyphs);

  return { glyphs, lines };
}

function collectRuns(box: RenderBox): Run[] {
  const runs = [...box.textRuns];
  for (const child of box.children) {
    runs.push(...collectRuns(child));
  }
  return runs;
}

function convertRunToGlyphEntries(run: Run): GlyphEntry[] {
  const glyphRun = run.glyphs;
  if (!glyphRun) {
    return [];
  }
  const lineStart = run.lineIndex ?? 0;
  const baseX = run.lineMatrix?.e ?? 0;
  const baseline = run.lineMatrix?.f ?? 0;
  const fontSize = run.fontSize ?? glyphRun.fontSize;
  const textChars = Array.from(glyphRun.text);

  return glyphRun.positions.map((position, index) => {
    const nextPosition = glyphRun.positions[index + 1]?.x;
    const runWidth = glyphRun.width ?? position.x;
    const width = Math.max((nextPosition ?? runWidth) - position.x, 0);
    return {
      char: textChars[index] ?? glyphRun.text[index] ?? "",
      width,
      height: fontSize,
      line: lineStart,
      x: baseX + position.x,
      y: baseline - fontSize,
    };
  });
}

function summarizePdfLines(glyphs: GlyphEntry[]): PdfLineSummary[] {
  const grouped = new Map<number, { start: number; end: number }>();
  for (const glyph of glyphs) {
    const current = grouped.get(glyph.line) ?? { start: Number.POSITIVE_INFINITY, end: Number.NEGATIVE_INFINITY };
    current.start = Math.min(current.start, glyph.x);
    current.end = Math.max(current.end, glyph.x + glyph.width);
    grouped.set(glyph.line, current);
  }
  return Array.from(grouped.entries())
    .map(([line, rect]) => ({
      line,
      start: rect.start === Infinity ? 0 : rect.start,
      end: rect.end === -Infinity ? 0 : rect.end,
      width: Math.max(0, rect.end - rect.start),
    }))
    .sort((a, b) => a.line - b.line);
}

async function enrichTreeWithGlyphRuns(root: RenderBox, fontResolver: FontRegistryResolver): Promise<void> {
  const stack: RenderBox[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.textRuns) {
      for (const run of node.textRuns) {
        await enrichRunGlyphData(run, fontResolver);
      }
    }
    for (const child of node.children) {
      stack.push(child);
    }
  }
}

async function enrichRunGlyphData(run: Run, fontResolver: FontRegistryResolver): Promise<void> {
  if (run.glyphs) {
    return;
  }
  try {
    const font = await fontResolver.resolve(run.fontFamily, run.fontWeight, run.fontStyle);
    const glyphRun = computeGlyphRun(font, run.text, run.fontSize, run.letterSpacing ?? 0);
    applyWordSpacingToGlyphRun(glyphRun, run.text, run.wordSpacing);
    run.glyphs = glyphRun;
  } catch (error) {
    console.warn("Failed to enrich glyph data for run:", run.text, error);
  }
}

// ----------------------------------------
// Comparison helpers
// ----------------------------------------

function reportComparison(browser: BrowserMeasurement, pdf: PdfMeasurement) {
  const count = Math.min(browser.glyphs.length, pdf.glyphs.length);
  console.log(`\nGlyph counts -> browser: ${browser.glyphs.length}, pdf: ${pdf.glyphs.length}`);

  const diffs = [];
  for (let i = 0; i < count; i++) {
    const before = browser.glyphs[i];
    const after = pdf.glyphs[i];
    diffs.push({
      index: i,
      char: before.char || after.char || "?",
      line: before.line,
      browserWidth: before.width,
      pdfWidth: after.width,
      diff: after.width - before.width,
    });
  }

  const averageDiff = diffs.reduce((sum, item) => sum + item.diff, 0) / (diffs.length || 1);
  const maxAbsDiff = Math.max(...diffs.map((item) => Math.abs(item.diff)), 0);
  console.log(`Average glyph width delta: ${averageDiff.toFixed(2)} px, max absolute delta: ${maxAbsDiff.toFixed(2)} px`);

  const reportCount = Math.min(10, diffs.length);
  console.log(`First ${reportCount} glyph comparisons (browser vs pdf widths):`);
  for (let i = 0; i < reportCount; i++) {
    const { char, browserWidth, pdfWidth, diff, line } = diffs[i];
    console.log(
      `  [line ${line}] '${previewChar(char)}' -> browser ${browserWidth.toFixed(2)}, pdf ${pdfWidth.toFixed(2)}, delta ${diff.toFixed(2)}`,
    );
  }

  const lineDiffs = combineLineWidths(browser.lines, pdf.lines);
  console.log("\nLine width comparison:");
  for (const lineDiff of lineDiffs) {
    console.log(
      `  line ${lineDiff.line}: browser ${lineDiff.browserWidth.toFixed(2)} px, pdf ${lineDiff.pdfWidth.toFixed(2)} px (delta ${lineDiff.delta.toFixed(2)} px)`,
    );
  }
}

function combineLineWidths(browserLines: BrowserLine[], pdfLines: PdfLineSummary[]) {
  const merged = new Map<number, { browserWidth: number; pdfWidth: number }>();
  for (const line of browserLines) {
    const entry = merged.get(line.line) ?? { browserWidth: 0, pdfWidth: 0 };
    entry.browserWidth = line.width;
    merged.set(line.line, entry);
  }
  for (const line of pdfLines) {
    const entry = merged.get(line.line) ?? { browserWidth: 0, pdfWidth: 0 };
    entry.pdfWidth = line.width;
    merged.set(line.line, entry);
  }
  return Array.from(merged.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([line, { browserWidth, pdfWidth }]) => ({
      line,
      browserWidth,
      pdfWidth,
      delta: pdfWidth - browserWidth,
    }));
}

function previewChar(value: string) {
  if (!value || value.trim().length === 0) {
    return value === " " ? "space" : "?";
  }
  return value.length === 1 ? value : value;
}

// ----------------------------------------
// CLI helpers
// ----------------------------------------

async function resolveOptions(): Promise<CompareOptions> {
  const args = parseCliArgs(process.argv.slice(2));
  const textFile = args["text-file"];
  const textFromFile = textFile ? await readFile(textFile, "utf-8") : undefined;
  const text = textFromFile ?? args["text"] ?? DEFAULT_TEXT;

  return {
    text,
    fontFamily: args["font-family"] ?? DEFAULT_CONFIG.fontFamily,
    fontSize: parseNumber(args["font-size"], DEFAULT_CONFIG.fontSize),
    textAlign: parseTextAlign(args["align"] ?? args["text-align"]) ?? DEFAULT_CONFIG.textAlign,
    direction: parseDirection(args["direction"]) ?? DEFAULT_CONFIG.direction,
    lineHeight: parseNumber(args["line-height"], DEFAULT_CONFIG.lineHeight),
    containerWidth: parseNumber(args["width"], DEFAULT_CONFIG.containerWidth),
    viewportHeight: parseNumber(args["viewport-height"], DEFAULT_CONFIG.viewportHeight),
    pageHeight: parseNumber(args["page-height"], DEFAULT_CONFIG.pageHeight),
  };
}

function parseCliArgs(argv: string[]): Record<string, string> {
  const collected: Record<string, string> = {};
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      continue;
    }
    const withoutPrefix = item.slice(2);
    const equalsIndex = withoutPrefix.indexOf("=");
    let key: string;
    let value: string;
    if (equalsIndex >= 0) {
      key = withoutPrefix.slice(0, equalsIndex);
      value = withoutPrefix.slice(equalsIndex + 1);
    } else {
      key = withoutPrefix;
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        value = next;
        index++;
      } else {
        value = "true";
      }
    }
    collected[key] = value;
  }
  return collected;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTextAlign(value: string | undefined): TextAlign | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "left" || normalized === "right" || normalized === "center" || normalized === "justify") {
    return normalized as TextAlign;
  }
  return undefined;
}

function parseDirection(value: string | undefined): Direction | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "ltr" || normalized === "rtl") {
    return normalized as Direction;
  }
  return undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

main().catch((error) => {
  console.error("Glyph comparison failed:", error);
  process.exit(1);
});
