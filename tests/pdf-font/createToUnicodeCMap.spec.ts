import { describe, it, expect } from "vitest";
import { createToUnicodeCMapText } from "../../src/pdf/font/embedder.js";

describe("createToUnicodeCMapText", () => {
  it("emits bfrange for consecutive gid->unicode runs (BMP)", () => {
    const entries = [
      { gid: 1, unicode: 0x0041 }, // A
      { gid: 2, unicode: 0x0042 }, // B
      { gid: 3, unicode: 0x0043 } // C
    ];
    const cmap = createToUnicodeCMapText(entries);
    // Should emit a single bfrange mapping from gid 1..3 -> unicode U+0041
    expect(cmap).toContain("<0001> <0003> <0041>");
  });

  it("emits surrogate pairs for non-BMP code points and supports bfrange", () => {
    // 😀 U+1F600 -> surrogate pair D83D DE00
    // 😁 U+1F601 -> surrogate pair D83D DE01
    const entries = [
      { gid: 10, unicode: 0x1f600 },
      { gid: 11, unicode: 0x1f601 }
    ];
    const cmap = createToUnicodeCMapText(entries);
    // Expect a bfrange mapping for gids 000A..000B and the start unicode to be the UTF-16BE hex for U+1F600
    expect(cmap).toContain("<000A> <000B> <D83DDE00>");
  });

  it("falls back to single-char blocks for non-consecutive mappings", () => {
    const entries = [
      { gid: 5, unicode: 0x0041 },
      { gid: 7, unicode: 0x0042 }
    ];
    const cmap = createToUnicodeCMapText(entries);
    // Should emit two beginbfchar entries (or at least individual mappings)
    expect(cmap).toContain("<0005> <0041>");
    expect(cmap).toContain("<0007> <0042>");
  });
});
