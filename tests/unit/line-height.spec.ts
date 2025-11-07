import { describe, expect, it } from "vitest";
import { resolvedLineHeight, type StyleAccumulator } from "../../src/css/style.js";
import {
  createLengthLineHeight,
  createNormalLineHeight,
  createUnitlessLineHeight,
  DEFAULT_NORMAL_LINE_HEIGHT,
  resolveLineHeightInput,
} from "../../src/css/line-height.js";
import { relativeLength } from "../../src/css/length.js";
import { parseLineHeight } from "../../src/css/parsers/dimension-parser.js";

describe("resolvedLineHeight", () => {
  it("falls back to normal when style is missing", () => {
    expect(resolvedLineHeight(undefined)).toBeCloseTo(16 * DEFAULT_NORMAL_LINE_HEIGHT);
  });

  it("uses the font size for normal keyword", () => {
    expect(
      resolvedLineHeight({ fontSize: 20, lineHeight: createNormalLineHeight() }),
    ).toBeCloseTo(20 * DEFAULT_NORMAL_LINE_HEIGHT);
  });

  it("multiplies font size for unitless values", () => {
    expect(
      resolvedLineHeight({ fontSize: 10, lineHeight: createUnitlessLineHeight(1.5) }),
    ).toBeCloseTo(15);
  });

  it("returns absolute lengths unchanged", () => {
    expect(
      resolvedLineHeight({ fontSize: 32, lineHeight: createLengthLineHeight(24) }),
    ).toBe(24);
  });
});

describe("resolveLineHeightInput", () => {
  it("converts relative lengths to px", () => {
    const input = { kind: "length" as const, value: relativeLength("em", 2) };
    const resolved = resolveLineHeightInput(input, 12, 16);
    expect(resolved).toEqual(createLengthLineHeight(24));
  });
});

describe("parseLineHeight", () => {
  it("parses normal keyword", () => {
    const target: StyleAccumulator = {};
    parseLineHeight("normal", target);
    expect(target.lineHeight).toEqual(createNormalLineHeight());
  });

  it("parses percentages into unitless multipliers", () => {
    const target: StyleAccumulator = {};
    parseLineHeight("150%", target);
    expect(target.lineHeight).toEqual(createUnitlessLineHeight(1.5));
  });

  it("parses absolute lengths", () => {
    const target: StyleAccumulator = {};
    parseLineHeight("24px", target);
    expect(target.lineHeight).toEqual(createLengthLineHeight(24));
  });
});
