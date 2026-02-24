import type { Radius } from "../types.js";

/**
 * Radius utility functions
 * Responsibility: Normalize and validate border radii for rectangles
 */

/**
 * Normalize radii to ensure they fit within rectangle bounds
 * Scales down radii proportionally if they exceed available space
 */
export function normalizeRadiiForRect(width: number, height: number, radii: Radius): Radius {
    const result: Radius = {
        topLeft: { ...radii.topLeft },
        topRight: { ...radii.topRight },
        bottomRight: { ...radii.bottomRight },
        bottomLeft: { ...radii.bottomLeft },
    };

    const safeWidth = Math.max(width, 0);
    const safeHeight = Math.max(height, 0);

    if (safeWidth <= 0 || safeHeight <= 0) {
        return {
            topLeft: { x: 0, y: 0 },
            topRight: { x: 0, y: 0 },
            bottomRight: { x: 0, y: 0 },
            bottomLeft: { x: 0, y: 0 },
        };
    }

    // CSS Backgrounds § 5.5: compute a single scale factor f = min(Li/Si)
    // across all four sides, then multiply ALL radii by f if f < 1.
    let f = 1;
    const topSumX = result.topLeft.x + result.topRight.x;
    if (topSumX > 0) f = Math.min(f, safeWidth / topSumX);
    const bottomSumX = result.bottomLeft.x + result.bottomRight.x;
    if (bottomSumX > 0) f = Math.min(f, safeWidth / bottomSumX);
    const leftSumY = result.topLeft.y + result.bottomLeft.y;
    if (leftSumY > 0) f = Math.min(f, safeHeight / leftSumY);
    const rightSumY = result.topRight.y + result.bottomRight.y;
    if (rightSumY > 0) f = Math.min(f, safeHeight / rightSumY);

    if (f < 1) {
        result.topLeft.x *= f;
        result.topLeft.y *= f;
        result.topRight.x *= f;
        result.topRight.y *= f;
        result.bottomRight.x *= f;
        result.bottomRight.y *= f;
        result.bottomLeft.x *= f;
        result.bottomLeft.y *= f;
    }

    return result;
}

/**
 * Check if all corner radii are zero
 */
export function isZeroRadius(radii: Radius): boolean {
    return (
        radii.topLeft.x === 0 &&
        radii.topLeft.y === 0 &&
        radii.topRight.x === 0 &&
        radii.topRight.y === 0 &&
        radii.bottomRight.x === 0 &&
        radii.bottomRight.y === 0 &&
        radii.bottomLeft.x === 0 &&
        radii.bottomLeft.y === 0
    );
}
