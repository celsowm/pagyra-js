import { describe, it, expect } from "vitest";
import { ComputedStyle } from "../../src/css/style.js";
import { resolveDecorations } from "../../src/pdf/utils/text-decoration-utils.js";

describe("text-decoration-utils", () => {
  it("parses multiple decoration tokens", () => {
    const style = new ComputedStyle({ textDecorationLine: "underline line-through" });
    expect(resolveDecorations(style)).toEqual({
      underline: true,
      lineThrough: true,
      color: { r: 0, g: 0, b: 0, a: 1 }
    });
  });

  it("returns undefined for none/empty values", () => {
    const style = new ComputedStyle({ textDecorationLine: "none" });
    expect(resolveDecorations(style)).toBeUndefined();
  });
});
