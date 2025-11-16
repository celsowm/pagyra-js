import { describe, it, expect } from "vitest";
import { computeHfTokens, applyPlaceholders } from "../../src/pdf/header-footer-tokens.js";

describe("header-footer-tokens", () => {
  it("computes placeholder map with defaults", () => {
    const tokens = computeHfTokens({ custom: "value" }, 10, { title: "Doc" });
    expect(tokens.get("custom")).toBe("value");
    expect(tokens.get("title")).toBe("Doc");
    expect(tokens.has("page")).toBe(true);
    expect(tokens.has("pages")).toBe(true);
    expect(tokens.has("date")).toBe(true);
  });

  it("applies placeholders in template text", () => {
    const tokens = computeHfTokens({ custom: "Hello" }, 10);
    const rendered = applyPlaceholders("Page {page} of {pages} - {custom}", tokens, 2, 5);
    expect(rendered).toContain("2");
    expect(rendered).toContain("5");
    expect(rendered).toContain("Hello");
  });
});
