import { describe, expect, it } from "vitest";
import { ImageRegistry } from "../../src/pdf/primitives/pdf-resource-registries.js";

describe("ImageRegistry deduplication", () => {
  it("deduplicates regular RGB images by src and dimensions", () => {
    const registry = new ImageRegistry();
    const image = {
      src: "logo.png",
      width: 1,
      height: 1,
      format: "png" as const,
      channels: 3,
      bitsPerComponent: 8,
      data: new Uint8Array([255, 0, 0]),
    };

    const firstRef = registry.register(image);
    const secondRef = registry.register(image);

    expect(secondRef).toBe(firstRef);
    expect(registry.getAll()).toHaveLength(1);
  });

  it("deduplicates RGBA PNG by returning the RGB image ref, not the SMask ref", () => {
    const registry = new ImageRegistry();
    const image = {
      src: "dice.png",
      width: 2,
      height: 1,
      format: "png" as const,
      channels: 4,
      bitsPerComponent: 8,
      data: new Uint8Array([
        255, 255, 255, 0,
        255, 0, 0, 255,
      ]),
    };

    const firstRef = registry.register(image);
    const secondRef = registry.register(image);
    const registered = registry.getAll();

    expect(secondRef).toBe(firstRef);
    expect(registered).toHaveLength(2);

    const rgbEntry = registered.find((entry) => entry.ref === firstRef);
    expect(rgbEntry?.colorSpace).toBe("DeviceRGB");
    expect(rgbEntry?.sMask).toBeDefined();

    const sMaskEntry = registered.find((entry) => entry.ref === rgbEntry?.sMask);
    expect(sMaskEntry?.colorSpace).toBe("DeviceGray");
  });
});
