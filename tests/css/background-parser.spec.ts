import { describe, expect, it } from "vitest";
import { parseBackground } from "../../src/css/parsers/background-parser-extended.js";
import type { StyleAccumulator } from "../../src/css/style.js";

describe("background shorthand parsing", () => {
  it("recognizes named colors", () => {
    const target: StyleAccumulator = {};
    parseBackground("skyblue", target);
    expect(target.backgroundLayers).toBeDefined();
    expect(
      target.backgroundLayers?.some((layer) => layer.kind === "color" && layer.color === "skyblue"),
    ).toBe(true);
  });
});
