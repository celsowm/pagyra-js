import { describe, it, expect } from "vitest";
import { extractDropShadowLayers } from "../../src/pdf/utils/filter-utils.js";
import type { FilterFunction } from "../../src/css/properties/visual.js";

describe("extractDropShadowLayers", () => {
  const fallbackColor = { r: 0, g: 0, b: 0, a: 1 };

  it("returns empty array for filters without drop-shadow", () => {
    const filters: FilterFunction[] = [
      { kind: "blur", value: 5 },
      { kind: "opacity", value: 0.5 },
    ];
    expect(extractDropShadowLayers(filters, fallbackColor)).toEqual([]);
  });

  it("extracts drop-shadow with all parameters", () => {
    const filters: FilterFunction[] = [{
      kind: "drop-shadow",
      offsetX: 2,
      offsetY: 4,
      blurRadius: 6,
      color: "red",
    }];
    const result = extractDropShadowLayers(filters, fallbackColor);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      inset: false,
      offsetX: 2,
      offsetY: 4,
      blur: 6,
      spread: 0,
      color: { r: 255, g: 0, b: 0, a: 1 },
    });
  });

  it("uses fallback color when drop-shadow has no color", () => {
    const filters: FilterFunction[] = [{
      kind: "drop-shadow",
      offsetX: 3,
      offsetY: 3,
      blurRadius: 5,
      color: undefined,
    }];
    const customFallback = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
    const result = extractDropShadowLayers(filters, customFallback);
    expect(result[0].color).toEqual(customFallback);
  });

  it("extracts multiple drop-shadow functions", () => {
    const filters: FilterFunction[] = [
      {
        kind: "drop-shadow",
        offsetX: 2,
        offsetY: 2,
        blurRadius: 4,
        color: "black",
      },
      {
        kind: "drop-shadow",
        offsetX: 4,
        offsetY: 4,
        blurRadius: 8,
        color: "red",
      },
    ];
    const result = extractDropShadowLayers(filters, fallbackColor);
    expect(result).toHaveLength(2);
  });

  it("clamps negative blur to 0", () => {
    const filters: FilterFunction[] = [{
      kind: "drop-shadow",
      offsetX: 2,
      offsetY: 2,
      blurRadius: -5,
      color: undefined,
    }];
    const result = extractDropShadowLayers(filters, fallbackColor);
    expect(result[0].blur).toBe(0);
  });
});
