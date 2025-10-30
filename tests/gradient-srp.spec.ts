import { describe, it, expect, beforeEach } from "vitest";
import { parseLinearGradient } from "../src/css/parsers/gradient-parser.js";
import { GradientService } from "../src/pdf/shading/gradient-service.js";
import { CoordinateTransformer } from "../src/pdf/utils/coordinate-transformer.js";

describe("GradientService", () => {
  const PAGE_HEIGHT_PT = 841.89;
  const PX_TO_PT = (px: number) => px * 0.75;
  let service: GradientService;

  beforeEach(() => {
    const transformer = new CoordinateTransformer(PAGE_HEIGHT_PT, PX_TO_PT, 0);
    service = new GradientService(transformer);
    service.clear();
  });

  it("creates shading dictionary with expected entries", () => {
    const gradient = parseLinearGradient("linear-gradient(to right, red, yellow)");
    expect(gradient).not.toBeNull();
    if (!gradient) {
      return;
    }

    const rect = { width: 200, height: 100 };
    const shading = service.createLinearGradient(gradient, rect);

    expect(shading.shadingName).toMatch(/^Sh\d+_\d+$/);
    expect(shading.dictionary).toContain("/ShadingType 2");
    expect(shading.dictionary).toContain("/ColorSpace /DeviceRGB");
    expect(shading.dictionary).toContain("/Function");
    expect(shading.dictionary).toContain("/Extend [true true]");
  });

  it("computes coordinates in points spanning the rectangle", () => {
    const gradient = parseLinearGradient("linear-gradient(to right, red, blue)");
    expect(gradient).not.toBeNull();
    if (!gradient) {
      return;
    }
    const rect = { width: 200, height: 100 };
    const shading = service.createLinearGradient(gradient, rect);
    const match = shading.dictionary.match(/\/Coords\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]/);
    expect(match).not.toBeNull();
    if (!match) {
      return;
    }
    const [, x0, y0, x1, y1] = match;
    const widthPt = PX_TO_PT(rect.width);
    const heightPt = PX_TO_PT(rect.height);
    expect(parseFloat(x0)).toBeCloseTo(0, 4);
    expect(parseFloat(y0)).toBeCloseTo(heightPt / 2, 4);
    expect(parseFloat(x1)).toBeCloseTo(widthPt, 4);
    expect(parseFloat(y1)).toBeCloseTo(heightPt / 2, 4);
  });

  it("tracks generated shadings", () => {
    const gradient = parseLinearGradient("linear-gradient(to bottom, #111111, #eeeeee)");
    expect(gradient).not.toBeNull();
    if (!gradient) {
      return;
    }
    service.createLinearGradient(gradient, { width: 50, height: 200 });
    service.createLinearGradient(gradient, { width: 80, height: 120 });

    const shadings = service.getShadings();
    expect(shadings.size).toBe(2);
    for (const [name, dictionary] of shadings.entries()) {
      expect(name).toMatch(/^Sh\d+_\d+$/);
      expect(dictionary).toContain("/ShadingType 2");
    }
  });

  it("clears accumulated shadings and resets counter", () => {
    const gradient = parseLinearGradient("linear-gradient(45deg, red, blue)");
    expect(gradient).not.toBeNull();
    if (!gradient) {
      return;
    }
    const first = service.createLinearGradient(gradient, { width: 120, height: 120 });
    expect(first.shadingName.endsWith("_0")).toBeTruthy();

    service.clear();
    const second = service.createLinearGradient(gradient, { width: 120, height: 120 });
    expect(second.shadingName.endsWith("_0")).toBeTruthy();
    expect(service.getShadings().size).toBe(1);
  });

  it("produces unique shading names per gradient within the same service", () => {
    const gradient = parseLinearGradient("linear-gradient(to left, #fff, #000)");
    expect(gradient).not.toBeNull();
    if (!gradient) {
      return;
    }
    const a = service.createLinearGradient(gradient, { width: 40, height: 40 });
    const b = service.createLinearGradient(gradient, { width: 60, height: 60 });
    expect(a.shadingName).not.toBe(b.shadingName);
    expect(a.shadingName.endsWith("_0")).toBeTruthy();
    expect(b.shadingName.endsWith("_1")).toBeTruthy();
  });
});
