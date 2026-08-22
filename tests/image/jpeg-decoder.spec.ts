import { JpegDecoder } from "../../src/image/jpeg-decoder.js";

function jpegWithSof(marker: number, width: number, height: number): ArrayBuffer {
  const bytes = new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, marker,
    0x00, 0x11,
    0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03,
    0x01, 0x11, 0x00,
    0x02, 0x11, 0x00,
    0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
  return bytes.buffer;
}

describe("JpegDecoder", () => {
  test("reads baseline SOF0 dimensions", async () => {
    const result = await new JpegDecoder().decode(jpegWithSof(0xc0, 200, 100));

    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
    expect(result.channels).toBe(3);
    expect(result.bitsPerChannel).toBe(8);
  });

  test("reads progressive SOF2 dimensions", async () => {
    const result = await new JpegDecoder().decode(jpegWithSof(0xc2, 1280, 720));

    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.channels).toBe(3);
    expect(result.bitsPerChannel).toBe(8);
  });

  test("rejects malformed segment length", async () => {
    const bytes = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x20,
      0x00, 0x00,
    ]);

    await expect(new JpegDecoder().decode(bytes.buffer)).rejects.toThrow(
      "Invalid JPEG: malformed segment length",
    );
  });
});
