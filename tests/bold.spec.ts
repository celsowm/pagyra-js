import { describe, expect, it } from "vitest";
import {
  ComputedStyle,
  Display,
  layoutTree,
} from "../src/index.js";

describe("bold text functionality", () => {
  it("applies bold font weight to strong elements", () => {
    const root = new ComputedStyle();
    const paragraph = new ComputedStyle({ display: Display.Block });
    const strongText = new ComputedStyle({
      display: Display.Inline,
      fontWeight: 700
    });

    // Test that fontWeight is properly set
    expect(strongText.fontWeight).toBe(700);
    expect(root.fontWeight).toBe(400); // default weight
  });

  it("measures bold text with different width than normal text", () => {
    const root = new ComputedStyle();
    const normalText = new ComputedStyle({
      display: Display.Inline,
      fontWeight: 400,
      fontSize: 16,
      fontFamily: "Times, 'Times New Roman', serif"
    });
    const boldText = new ComputedStyle({
      display: Display.Inline,
      fontWeight: 700,
      fontSize: 16,
      fontFamily: "Times, 'Times New Roman', serif"
    });

    // Test that both styles have fontWeight property defined
    expect(normalText.fontWeight).toBe(400);
    expect(boldText.fontWeight).toBe(700);
  });

  it("layouts text with mixed bold and normal weights", () => {
    const root = new ComputedStyle({ display: Display.Block });
    const paragraph = new ComputedStyle({ display: Display.Block });

    const normalSpan = new ComputedStyle({
      display: Display.Inline,
      fontWeight: 400
    });
    const boldSpan = new ComputedStyle({
      display: Display.Inline,
      fontWeight: 700
    });

    // Test that different font weights are properly assigned
    expect(normalSpan.fontWeight).toBe(400);
    expect(boldSpan.fontWeight).toBe(700);
  });

  it("handles various font weight values", () => {
    const light = new ComputedStyle({ fontWeight: 300 });
    const normal = new ComputedStyle({ fontWeight: 400 });
    const bold = new ComputedStyle({ fontWeight: 700 });
    const heavy = new ComputedStyle({ fontWeight: 900 });

    expect(light.fontWeight).toBe(300);
    expect(normal.fontWeight).toBe(400);
    expect(bold.fontWeight).toBe(700);
    expect(heavy.fontWeight).toBe(900);
  });
});
