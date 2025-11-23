import { describe, expect, it } from "vitest";
import { resolveBlockAutoMargins } from "../../../src/layout/utils/node-math.js";

describe("resolveBlockAutoMargins", () => {
  it("splits remaining inline space when both margins are auto", () => {
    const { marginLeft, marginRight } = resolveBlockAutoMargins(500, 236, "auto", "auto");
    expect(marginLeft).toBeCloseTo(132);
    expect(marginRight).toBeCloseTo(132);
  });

  it("assigns all remaining space to a single auto margin", () => {
    const { marginLeft, marginRight } = resolveBlockAutoMargins(400, 150, "auto", 10);
    expect(marginLeft).toBeCloseTo(240);
    expect(marginRight).toBeCloseTo(10);
  });

  it("reduces the right margin when content overflows and no auto margins are present", () => {
    const { marginLeft, marginRight } = resolveBlockAutoMargins(200, 180, 20, 15);
    expect(marginLeft).toBeCloseTo(20);
    expect(marginRight).toBeCloseTo(0);
  });
});
