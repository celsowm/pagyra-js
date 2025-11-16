import { describe, expect, it } from "vitest";
import { encodeAndEscapePdfText } from "../../src/pdf/utils/encoding.js";

describe("encodeAndEscapePdfText", () => {
  it("preserves Unicode bullets when using Identity-H", () => {
    const squareBullet = "\u25AA";
    const encoded = encodeAndEscapePdfText(squareBullet, "Identity-H");
    expect(encoded).toBe(squareBullet);
  });

  it("falls back to ? when WinAnsi cannot represent a glyph", () => {
    const squareBullet = "\u25AA";
    const encoded = encodeAndEscapePdfText(squareBullet, "WinAnsi");
    expect(encoded).toBe("?");
  });

  it("still escapes PDF literal syntax when using Identity-H", () => {
    const text = "(bullet)";
    const encoded = encodeAndEscapePdfText(text, "Identity-H");
    expect(encoded).toBe("\\(bullet\\)");
  });
});
