import { describe, it, expect } from "vitest";
import { computeBackgroundTileRects, intersectRects, rectEquals } from "../../src/pdf/utils/background-tiles.js";

describe("background tile utilities", () => {
  it("intersects rectangles correctly", () => {
    const a = { x: 10, y: 10, width: 20, height: 20 };
    const b = { x: 15, y: 5, width: 20, height: 20 };
    const intersection = intersectRects(a, b);

    expect(intersection).toEqual({ x: 15, y: 10, width: 15, height: 15 });
  });

  it("compares rectangles with tolerance", () => {
    const a = { x: 0, y: 0, width: 40, height: 40 };
    const b = { x: 0.005, y: -0.004, width: 40.003, height: 39.999 };
    expect(rectEquals(a, b)).toBe(true);
  });

  it("returns single clipped rect for no-repeat", () => {
    const tile = { x: 10, y: 5, width: 20, height: 10 };
    const clip = { x: 0, y: 0, width: 100, height: 100 };

    const tiles = computeBackgroundTileRects(tile, clip, "no-repeat");

    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toEqual(tile);
  });

  it("returns empty array for no-repeat when fully outside clip", () => {
    const tile = { x: -50, y: -50, width: 10, height: 10 };
    const clip = { x: 0, y: 0, width: 20, height: 20 };

    const tiles = computeBackgroundTileRects(tile, clip, "no-repeat");
    expect(tiles).toHaveLength(0);
  });

  it("tiles in both directions for repeat", () => {
    const tile = { x: 0, y: 0, width: 10, height: 10 };
    const clip = { x: 0, y: 0, width: 25, height: 25 };

    const tiles = computeBackgroundTileRects(tile, clip, "repeat");

    // Expect 3x3 grid: positions (0,0), (10,0), (20,0), ... (20,20)
    expect(tiles).toHaveLength(9);
    const positions = tiles.map((t) => [t.x, t.y]);
    expect(positions).toContainEqual([0, 0]);
    expect(positions).toContainEqual([10, 0]);
    expect(positions).toContainEqual([20, 0]);
    expect(positions).toContainEqual([0, 10]);
    expect(positions).toContainEqual([20, 20]);
  });

  it("tiles only horizontally for repeat-x", () => {
    const tile = { x: 0, y: 0, width: 10, height: 10 };
    const clip = { x: 0, y: 0, width: 25, height: 10 };

    const tiles = computeBackgroundTileRects(tile, clip, "repeat-x");

    expect(tiles).toHaveLength(3);
    const ys = new Set(tiles.map((t) => t.y));
    expect(ys.size).toBe(1);
  });

  it("tiles only vertically for repeat-y", () => {
    const tile = { x: 0, y: 0, width: 10, height: 10 };
    const clip = { x: 0, y: 0, width: 10, height: 25 };

    const tiles = computeBackgroundTileRects(tile, clip, "repeat-y");

    expect(tiles).toHaveLength(3);
    const xs = new Set(tiles.map((t) => t.x));
    expect(xs.size).toBe(1);
  });
});

