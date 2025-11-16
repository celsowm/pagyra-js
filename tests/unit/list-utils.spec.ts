import { describe, expect, it } from "vitest";
import { formatListMarker } from "../../src/pdf/utils/list-utils.js";

describe("formatListMarker", () => {
  it("returns decimal markers by default", () => {
    expect(formatListMarker("decimal", 3)).toBe("3.");
    expect(formatListMarker("decimal-leading-zero", 5)).toBe("05.");
  });

  it("supports alphabetic sequences", () => {
    expect(formatListMarker("lower-alpha", 1)).toBe("a.");
    expect(formatListMarker("lower-alpha", 28)).toBe("ab.");
    expect(formatListMarker("upper-alpha", 52)).toBe("AZ.");
  });

  it("supports roman numerals", () => {
    expect(formatListMarker("lower-roman", 4)).toBe("iv.");
    expect(formatListMarker("upper-roman", 14)).toBe("XIV.");
  });

  it("omits markers when list-style-type is none", () => {
    expect(formatListMarker("none", 1)).toBeUndefined();
  });
});

