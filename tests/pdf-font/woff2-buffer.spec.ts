import { describe, expect, it } from "vitest";
import { Buf, read255UShort } from "../../src/fonts/woff2/buffer.js";

describe("woff2 buffer utilities", () => {
  it("decodes 255UShort per WOFF2 spec", () => {
    const data = new Uint8Array([
      0, // direct
      252, // direct max
      255, 5, // 253 + 5 = 258
      254, 10, // 506 + 10 = 516
      253, 0x12, 0x34, // full 0x1234
    ]);
    const buf = new Buf(data);
    expect(read255UShort(buf)).toBe(0);
    expect(read255UShort(buf)).toBe(252);
    expect(read255UShort(buf)).toBe(258);
    expect(read255UShort(buf)).toBe(516);
    expect(read255UShort(buf)).toBe(0x1234);
  });
});
