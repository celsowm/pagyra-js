import { describe, expect, it } from "vitest";

// Import the selector functions we want to test
import { parseSelector } from "../src/css/selectors/parser.js";

describe("Advanced CSS Selectors - Parser", () => {
  it("should parse basic selectors correctly", () => {
    const result = parseSelector("div");
    expect(result).not.toBeNull();
    expect(result![0].simple.tag).toBe("div");
  });

  it("should parse ID selectors", () => {
    const result = parseSelector("#myId");
    expect(result).not.toBeNull();
    expect(result![0].simple.id).toBe("myId");
  });

  it("should parse class selectors", () => {
    const result = parseSelector(".myClass");
    expect(result).not.toBeNull();
    expect(result![0].simple.classes).toContain("myClass");
  });

  it("should parse attribute selectors", () => {
    const result = parseSelector("[data-test='value']");
    expect(result).not.toBeNull();
    expect(result![0].simple.attrs).toHaveLength(1);
    expect(result![0].simple.attrs[0].name).toBe("data-test");
    expect(result![0].simple.attrs[0].op).toBe("=");
    expect(result![0].simple.attrs[0].value).toBe("value");
  });

  it("should parse attribute selectors with different operators", () => {
    const result = parseSelector("[title~='flower']");
    expect(result).not.toBeNull();
    expect(result![0].simple.attrs[0].op).toBe("~=");
    expect(result![0].simple.attrs[0].value).toBe("flower");
  });

  it("should parse pseudo-selectors", () => {
    const result = parseSelector(":first-child");
    expect(result).not.toBeNull();
    expect(result![0].simple.pseudos).toHaveLength(1);
    expect(result![0].simple.pseudos[0].kind).toBe("first-child");
  });

  it("should parse nth-child pseudo-selectors", () => {
    const result = parseSelector(":nth-child(2n+1)");
    expect(result).not.toBeNull();
    expect(result![0].simple.pseudos).toHaveLength(1);
    expect(result![0].simple.pseudos[0].kind).toBe("nth-child");
    const pseudo = result![0].simple.pseudos[0] as any;
    expect(pseudo.a).toBe(2);
    expect(pseudo.b).toBe(1);
  });

  it("should parse :not() pseudo-selectors", () => {
    const result = parseSelector(":not(.class)");
    expect(result).not.toBeNull();
    expect(result![0].simple.pseudos).toHaveLength(1);
    expect(result![0].simple.pseudos[0].kind).toBe("not");
    expect((result![0].simple.pseudos[0] as any).inner).toBeDefined();
  });

  it("should parse descendant combinators", () => {
    const result = parseSelector("div p");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![1].combinatorToLeft).toBe(" ");
  });

  it("should parse child combinators", () => {
    const result = parseSelector("div > p");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![1].combinatorToLeft).toBe(">");
  });

  it("should parse adjacent sibling combinators", () => {
    const result = parseSelector("div + p");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![1].combinatorToLeft).toBe("+");
  });

  it("should parse general sibling combinators", () => {
    const result = parseSelector("div ~ p");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![1].combinatorToLeft).toBe("~");
  });

  it("should handle complex selectors", () => {
    const result = parseSelector("div#myId.class1.class2[attr='value'] > p:nth-child(2n+1)");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
  });
});
