import { ComputedStyle } from "../../src/css/style.js";
import { breakTextIntoLines } from "../../src/text/line-breaker.js";

describe("text line breaker regressions", () => {
  it("preserves long unbreakable text when emergency wrapping", () => {
    const text = "a".repeat(512);
    const style = new ComputedStyle({
      fontFamily: "Helvetica",
      fontSize: 12,
      overflowWrap: "anywhere",
      letterSpacing: 0.25,
    });

    const lines = breakTextIntoLines(text, style, 40);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((line) => line.text).join("")).toBe(text);
    for (const line of lines) {
      expect(line.width).toBeLessThanOrEqual(40.001);
    }
  });

  it("counts only spaces between words as justifiable", () => {
    const style = new ComputedStyle({
      fontFamily: "Helvetica",
      fontSize: 12,
    });

    const [line] = breakTextIntoLines("  alpha   beta   gamma  ", style, 1000);

    expect(line.text).toBe("alpha   beta   gamma");
    expect(line.spaceCount).toBe(2);
  });

  it("keeps reconstructed lines in visual order", () => {
    const style = new ComputedStyle({
      fontFamily: "Helvetica",
      fontSize: 12,
    });

    const lines = breakTextIntoLines("one two three four five", style, 55);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].text.startsWith("one")).toBe(true);
    expect(lines.at(-1)?.text.endsWith("five")).toBe(true);
  });
});
