import { describe, it, expect } from "vitest";
import { parseGridTemplate, parseGap } from "../src/css/parsers/grid-parser.js";

describe("Grid parser - track list", () => {
  it("parses fixed and flexible tracks", () => {
    const tracks = parseGridTemplate("220px 1fr");
    expect(tracks).toBeDefined();
    expect(tracks).toHaveLength(2);

    const fixed = tracks?.[0];
    expect(fixed).toMatchObject({ kind: "fixed", size: 220 });

    const flex = tracks?.[1];
    expect(flex).toMatchObject({ kind: "flex", flex: 1 });
  });

  it("parses repeat with auto-fit minmax", () => {
    const tracks = parseGridTemplate("repeat(auto-fit, minmax(220px, 1fr))");
    expect(tracks).toBeDefined();
    expect(tracks).toHaveLength(1);

    const repeat = tracks?.[0];
    expect(repeat).toMatchObject({
      kind: "repeat-auto",
      mode: "auto-fit",
    });

    if (repeat && repeat.kind === "repeat-auto") {
      expect(repeat.track).toMatchObject({
        kind: "flex",
        flex: 1,
        min: 220,
      });
    }
  });

  it("parses repeat with explicit count", () => {
    const tracks = parseGridTemplate("repeat(3, 100px)");
    expect(tracks).toBeDefined();
    expect(tracks).toHaveLength(1);
    const repeat = tracks?.[0];
    expect(repeat).toMatchObject({
      kind: "repeat",
      count: 3,
    });
    if (repeat && repeat.kind === "repeat") {
      expect(repeat.track).toMatchObject({
        kind: "fixed",
        size: 100,
      });
    }
  });

  it("returns undefined for invalid syntax", () => {
    expect(parseGridTemplate("repeat(auto-fit)")).toBeUndefined();
    expect(parseGridTemplate("fr 1")).toBeUndefined();
  });
});

describe("Grid parser - gap shorthand", () => {
  it("parses single value gap", () => {
    const gap = parseGap("24px");
    expect(gap).toEqual({ row: 24, column: 24 });
  });

  it("parses row and column gap values", () => {
    const gap = parseGap("16px 8px");
    expect(gap).toEqual({ row: 16, column: 8 });
  });

  it("returns undefined for invalid gap", () => {
    expect(parseGap("auto")).toBeUndefined();
    expect(parseGap("")).toBeUndefined();
  });
});
