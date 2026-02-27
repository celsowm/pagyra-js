import { describe, it, expect } from "vitest";
import { parseFilterList } from "../../src/css/parsers/filter-parser.js";

describe("parseFilterList", () => {
  // Keywords globais
  it("returns [] for 'none'", () => {
    expect(parseFilterList("none")).toEqual([]);
  });

  it("returns [] for 'initial'", () => {
    expect(parseFilterList("initial")).toEqual([]);
  });

  it("returns undefined for 'inherit'", () => {
    expect(parseFilterList("inherit")).toBeUndefined();
  });

  it("returns undefined for 'revert'", () => {
    expect(parseFilterList("revert")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseFilterList("")).toBeUndefined();
  });

  // Funções individuais
  it("parses blur(5px)", () => {
    const result = parseFilterList("blur(5px)");
    expect(result).toEqual([{ kind: "blur", value: 5 }]);
  });

  it("parses blur() with no args as blur(0px)", () => {
    const result = parseFilterList("blur()");
    expect(result).toEqual([{ kind: "blur", value: 0 }]);
  });

  it("parses brightness(1.5)", () => {
    const result = parseFilterList("brightness(1.5)");
    expect(result).toEqual([{ kind: "brightness", value: 1.5 }]);
  });

  it("parses brightness(150%)", () => {
    const result = parseFilterList("brightness(150%)");
    expect(result).toEqual([{ kind: "brightness", value: 1.5 }]);
  });

  it("parses opacity(50%)", () => {
    const result = parseFilterList("opacity(50%)");
    expect(result).toEqual([{ kind: "opacity", value: 0.5 }]);
  });

  it("clamps opacity to [0, 1]", () => {
    const result = parseFilterList("opacity(200%)");
    expect(result).toEqual([{ kind: "opacity", value: 1 }]);
  });

  it("clamps grayscale to [0, 1]", () => {
    const result = parseFilterList("grayscale(150%)");
    expect(result).toEqual([{ kind: "grayscale", value: 1 }]);
  });

  it("does not clamp brightness above 1", () => {
    const result = parseFilterList("brightness(3)");
    expect(result).toEqual([{ kind: "brightness", value: 3 }]);
  });

  // Ângulos
  it("parses hue-rotate(90deg)", () => {
    const result = parseFilterList("hue-rotate(90deg)");
    expect(result).toEqual([{ kind: "hue-rotate", valueDeg: 90 }]);
  });

  it("parses hue-rotate(0.5turn)", () => {
    const result = parseFilterList("hue-rotate(0.5turn)");
    expect(result).toEqual([{ kind: "hue-rotate", valueDeg: 180 }]);
  });

  it("parses hue-rotate(3.14159rad)", () => {
    const result = parseFilterList("hue-rotate(3.14159rad)");
    expect(result![0].kind).toBe("hue-rotate");
    expect((result![0] as import("../../src/css/properties/visual.js").HueRotateFilterFunction).valueDeg).toBeCloseTo(180, 1);
  });

  it("parses hue-rotate with negative angle", () => {
    const result = parseFilterList("hue-rotate(-45deg)");
    expect(result).toEqual([{ kind: "hue-rotate", valueDeg: -45 }]);
  });

  // drop-shadow
  it("parses drop-shadow(2px 4px 6px black)", () => {
    const result = parseFilterList("drop-shadow(2px 4px 6px black)");
    expect(result).toEqual([{
      kind: "drop-shadow",
      offsetX: 2,
      offsetY: 4,
      blurRadius: 6,
      color: "black",
    }]);
  });

  it("parses drop-shadow with only offsets", () => {
    const result = parseFilterList("drop-shadow(2px 4px)");
    expect(result).toEqual([{
      kind: "drop-shadow",
      offsetX: 2,
      offsetY: 4,
      blurRadius: 0,
      color: undefined,
    }]);
  });

  it("parses drop-shadow with rgb() color", () => {
    const result = parseFilterList("drop-shadow(1px 1px 3px rgb(255, 0, 0))");
    expect(result![0].kind).toBe("drop-shadow");
    expect((result![0] as import("../../src/css/properties/visual.js").DropShadowFilterFunction).color).toBe("rgb(255, 0, 0)");
  });

  // Múltiplas funções
  it("parses multiple functions separated by space", () => {
    const result = parseFilterList("blur(2px) opacity(0.5) brightness(1.2)");
    expect(result).toHaveLength(3);
    expect(result![0]).toEqual({ kind: "blur", value: 2 });
    expect(result![1]).toEqual({ kind: "opacity", value: 0.5 });
    expect(result![2]).toEqual({ kind: "brightness", value: 1.2 });
  });

  // Valores inválidos
  it("returns undefined for unknown function", () => {
    const result = parseFilterList("foo(42)");
    expect(result).toBeUndefined();
  });

  it("drops invalid values but keeps valid ones", () => {
    const result = parseFilterList("blur(5px) unknown(42) opacity(0.8)");
    expect(result).toHaveLength(2);
    expect(result![0].kind).toBe("blur");
    expect(result![1].kind).toBe("opacity");
  });
});
