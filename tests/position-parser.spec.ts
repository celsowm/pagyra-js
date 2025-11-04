import { describe, expect, it } from "vitest";
import { Position } from "../src/css/enums.js";
import {
  parseBottom,
  parseLeft,
  parsePosition,
  parseRight,
  parseTop,
} from "../src/css/parsers/position-parser.js";
import type { StyleAccumulator } from "../src/css/style.js";

describe("position parser", () => {
  it("parses valid position keywords", () => {
    const target: StyleAccumulator = {};
    parsePosition("absolute", target);
    expect(target.position).toBe(Position.Absolute);

    parsePosition(" fixed ", target);
    expect(target.position).toBe(Position.Fixed);
  });

  it("parses inset values with lengths and percentages", () => {
    const target: StyleAccumulator = {};

    parseTop("20px", target);
    expect(target.top).toBe(20);

    parseLeft("50%", target);
    expect(target.left).toEqual({ kind: "absolute", unit: "percent", value: 0.5 });

    parseRight("auto", target);
    expect(target.right).toBe("auto");
  });

  it("ignores invalid values", () => {
    const target: StyleAccumulator = {};

    parsePosition("unknown", target);
    expect(target.position).toBeUndefined();

    parseBottom("not-a-length", target);
    expect(target.bottom).toBeUndefined();
  });
});

