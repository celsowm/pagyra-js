import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { parseZIndex } from "../src/css/parsers/dimension-parser.js";
import type { StyleAccumulator } from "../src/css/style.js";
import { renderHtmlToPdf } from "../src/html-to-pdf.js";
import { log } from "../src/debug/log.js";

// Mock do logger
vi.mock("../src/debug/log.js", () => {
  const log = vi.fn();
  const configureDebug = vi.fn();
  return { log, configureDebug, default: { log, configureDebug } };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("z-index parser", () => {
  it("parses auto value", () => {
    const target: StyleAccumulator = {};
    parseZIndex("auto", target);
    expect(target.zIndex).toBe("auto");
  });

  it("parses positive integer values", () => {
    const target: StyleAccumulator = {};
    parseZIndex("5", target);   expect(target.zIndex).toBe(5);
    parseZIndex("0", target);   expect(target.zIndex).toBe(0);
    parseZIndex("100", target); expect(target.zIndex).toBe(100);
  });

  it("parses negative integer values", () => {
    const target: StyleAccumulator = {};
    parseZIndex("-1", target);   expect(target.zIndex).toBe(-1);
    parseZIndex("-999", target); expect(target.zIndex).toBe(-999);
  });

  it("ignores non-integer values", () => {
    const target: StyleAccumulator = {};
    parseZIndex("1.5", target); expect(target.zIndex).toBeUndefined();
    parseZIndex("2.0", target); expect(target.zIndex).toBeUndefined();
  });

  it("ignores invalid values", () => {
    const target: StyleAccumulator = {};
    parseZIndex("invalid", target); expect(target.zIndex).toBeUndefined();
    parseZIndex("", target);        expect(target.zIndex).toBeUndefined();
    parseZIndex("px", target);      expect(target.zIndex).toBeUndefined();
  });

  it("handles whitespace", () => {
    const target: StyleAccumulator = {};
    parseZIndex("  10  ", target);   expect(target.zIndex).toBe(10);
    parseZIndex("\tauto\t", target); expect(target.zIndex).toBe("auto");
  });
});

describe("z-index rendering", () => {
  it("correctly renders elements based on z-index", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div style="position:absolute; z-index:3; background:red;   width:100px; height:100px; top:10px; left:10px;">Top</div>
          <div style="position:absolute; z-index:1; background:blue;  width:100px; height:100px; top:20px; left:20px;">Bottom</div>
          <div style="position:absolute; z-index:2; background:green; width:100px; height:100px; top:15px; left:15px;">Middle</div>
        </body>
      </html>
    `;

    const css = `
      div {
        position: absolute;
        font-family: Arial;
        font-size: 12px;
      }
    `;

    await renderHtmlToPdf({
      html,
      css,
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 800,
      pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true,
      debugCats: ["RENDER_TREE", "PAINT", "STYLE", "PARSE", "LAYOUT"]
    });

    // Não exigimos categoria inexistente. Só checamos que houve coleta para sorting.
    expect(log).toHaveBeenCalledWith(
      "PAINT",
      "DEBUG",
      expect.stringContaining("Collecting render commands")
    );

    const calls = (log as unknown as Mock).mock.calls;
    const paintOrder = calls
      .filter(c => c[0] === "PAINT" && c[1] === "DEBUG")
      .map(c => String(c[2]))
      .filter(msg => msg.includes("Painting element"));

    // Ordem esperada: 1 (fundo), 2 (meio), 3 (topo)
    expect(paintOrder).toEqual([
      expect.stringContaining("z-index: 1"),
      expect.stringContaining("z-index: 2"),
      expect.stringContaining("z-index: 3"),
    ]);
  });
});
