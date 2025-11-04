import { describe, it, expect } from "vitest";
import { parseZIndex } from "../src/css/parsers/dimension-parser.js";
import type { StyleAccumulator } from "../src/css/style.js";

describe("z-index parser", () => {
  it("parses auto value", () => {
    const target: StyleAccumulator = {};
    parseZIndex("auto", target);
    expect(target.zIndex).toBe("auto");
  });

  it("parses positive integer values", () => {
    const target: StyleAccumulator = {};
    parseZIndex("5", target);
    expect(target.zIndex).toBe(5);

    parseZIndex("0", target);
    expect(target.zIndex).toBe(0);

    parseZIndex("100", target);
    expect(target.zIndex).toBe(100);
  });

  it("parses negative integer values", () => {
    const target: StyleAccumulator = {};
    parseZIndex("-1", target);
    expect(target.zIndex).toBe(-1);

    parseZIndex("-999", target);
    expect(target.zIndex).toBe(-999);
  });

  it("ignores non-integer values", () => {
    const target: StyleAccumulator = {};
    parseZIndex("1.5", target);
    expect(target.zIndex).toBeUndefined();

    parseZIndex("2.0", target);
    expect(target.zIndex).toBeUndefined();
  });

  it("ignores invalid values", () => {
    const target: StyleAccumulator = {};
    parseZIndex("invalid", target);
    expect(target.zIndex).toBeUndefined();

    parseZIndex("", target);
    expect(target.zIndex).toBeUndefined();

    parseZIndex("px", target);
    expect(target.zIndex).toBeUndefined();
  });

  it("handles whitespace", () => {
    const target: StyleAccumulator = {};
    parseZIndex("  10  ", target);
    expect(target.zIndex).toBe(10);

    parseZIndex("\tauto\t", target);
    expect(target.zIndex).toBe("auto");
  });
});
