import { describe, it, expect } from "vitest";
import { extractOpacityMultiplier } from "../../src/pdf/utils/filter-utils.js";
import type { FilterFunction } from "../../src/css/properties/visual.js";

describe("extractOpacityMultiplier", () => {
  it("returns 1 for empty filter list", () => {
    expect(extractOpacityMultiplier([])).toBe(1);
  });

  it("returns value for single opacity()", () => {
    const filters: FilterFunction[] = [{ kind: "opacity", value: 0.5 }];
    expect(extractOpacityMultiplier(filters)).toBe(0.5);
  });

  it("multiplies multiple opacity() filters", () => {
    const filters: FilterFunction[] = [
      { kind: "opacity", value: 0.5 },
      { kind: "opacity", value: 0.5 },
    ];
    expect(extractOpacityMultiplier(filters)).toBe(0.25);
  });

  it("ignores non-opacity filters", () => {
    const filters: FilterFunction[] = [
      { kind: "blur", value: 5 },
      { kind: "opacity", value: 0.7 },
      { kind: "brightness", value: 1.5 },
    ];
    expect(extractOpacityMultiplier(filters)).toBeCloseTo(0.7);
  });

  it("clamps result to [0, 1]", () => {
    const filters: FilterFunction[] = [{ kind: "opacity", value: 0 }];
    expect(extractOpacityMultiplier(filters)).toBe(0);
  });
});
