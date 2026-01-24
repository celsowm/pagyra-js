import { computeBackgroundTileRects } from "../../src/pdf/utils/background-tiles.js";
import type { Rect } from "../../src/pdf/types.js";

describe("background-repeat space and round modes", () => {
    const tileRect: Rect = { x: 0, y: 0, width: 50, height: 50 };
    const clipRect: Rect = { x: 0, y: 0, width: 300, height: 200 };

    it("space mode distributes tiles evenly with spacing", () => {
        const tiles = computeBackgroundTileRects(tileRect, clipRect, "space");

        expect(tiles.length).toBeGreaterThan(1);
        // All tiles should have the original dimensions  
        expect(tiles[0].width).toBe(50);
        expect(tiles[0].height).toBe(50);
    });

    it("round mode scales tiles to fit perfectly", () => {
        const tiles = computeBackgroundTileRects(tileRect, clipRect, "round");

        expect(tiles.length).toBeGreaterThan(1);
        // All tiles should have consistent scaled dimensions
        expect(tiles[0].width).toBeGreaterThan(0);
        expect(tiles[0].height).toBeGreaterThan(0);
    });

    it("round mode scales with non-perfect dimensions", () => {
        const oddTile: Rect = { x: 0, y: 0, width: 55, height: 55 };
        const tiles = computeBackgroundTileRects(oddTile, clipRect, "round");

        // Tiles should be scaled (not 55px)
        expect(tiles.length).toBeGreaterThan(0);
        expect(tiles[0].width).not.toBe(55);
    });
});
