import { describe, it, expect } from "vitest";
import { applyTextTransform } from "../../src/text/text-transform.js";

describe("applyTextTransform utility", () => {
  it("uppercases and lowercases strings deterministically", () => {
    expect(applyTextTransform("MiXeD Case", "uppercase")).toBe("MIXED CASE");
    expect(applyTextTransform("MiXeD Case", "lowercase")).toBe("mixed case");
  });

  it("capitalizes each word boundary and normalizes inner letters to lowercase", () => {
    expect(applyTextTransform("sOME\tWORds", "capitalize")).toBe("Some\tWords");
    expect(applyTextTransform("multi-word example", "capitalize")).toBe("Multi-Word Example");
  });
});
