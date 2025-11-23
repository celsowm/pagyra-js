import { describe, it, expect } from "vitest";
import { TextDecorationRenderer } from "../src/pdf/renderers/text-decoration-renderer.js";
import { CoordinateTransformer } from "../src/pdf/utils/coordinate-transformer.js";
import type { Run, RGBA } from "../src/pdf/types.js";

function createRun(overrides: Partial<Run> = {}): Run {
  return {
    text: "Decorated",
    fontFamily: "Helvetica",
    fontSize: 16,
    fill: { r: 0, g: 0, b: 0, a: 1 },
    lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: 20, f: 40 },
    decorations: { underline: true },
    advanceWidth: 60,
    ...overrides,
  };
}

describe("TextDecorationRenderer", () => {
  const transformer = new CoordinateTransformer(792, (px) => px * 0.75, 0);

  it("emits rectangles tinted with explicit decoration color", () => {
    const decorationColor: RGBA = { r: 255, g: 0, b: 0, a: 1 };
    const renderer = new TextDecorationRenderer(transformer);
    const run = createRun({ decorations: { underline: true, color: decorationColor } });
    const commands = renderer.render(run, run.fill);

    expect(commands[0]).toBe("1 0 0 rg");
    expect(commands.some((cmd) => / re$/.test(cmd))).toBe(true);
  });

  it("falls back to text color when decoration color is missing", () => {
    const renderer = new TextDecorationRenderer(transformer);
    const fill: RGBA = { r: 0, g: 0, b: 255, a: 1 };
    const run = createRun({ fill });
    const commands = renderer.render(run, fill);

    expect(commands[0]).toBe("0 0 1 rg");
  });

  it("renders double underlines when style is double", () => {
    const renderer = new TextDecorationRenderer(transformer);
    const run = createRun({ decorations: { underline: true, style: "double" } });
    const commands = renderer.render(run, run.fill);

    expect(commands.filter((cmd) => / re$/.test(cmd))).toHaveLength(2);
  });

  it("renders dashed underline when style is dashed", () => {
    const renderer = new TextDecorationRenderer(transformer);
    const run = createRun({ decorations: { underline: true, style: "dashed" } });
    const commands = renderer.render(run, run.fill);

    expect(commands.join(" ")).toContain("] 0 d");
    expect(commands.some((cmd) => / m$/.test(cmd))).toBe(true);
  });

  it("renders wavy underline when style is wavy", () => {
    const renderer = new TextDecorationRenderer(transformer);
    const run = createRun({ decorations: { underline: true, style: "wavy" } });
    const commands = renderer.render(run, run.fill);

    expect(commands.some((cmd) => / m$/.test(cmd))).toBe(true);
    expect(commands.some((cmd) => / l$/.test(cmd))).toBe(true);
  });
});
