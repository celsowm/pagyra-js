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

    if (safeWidth <= 0) {
        result.topLeft.x = 0;
        result.topRight.x = 0;
        result.bottomRight.x = 0;
        result.bottomLeft.x = 0;
    } else {
        const topSum = result.topLeft.x + result.topRight.x;
        if (topSum > safeWidth && topSum > 0) {
            const scale = safeWidth / topSum;
            result.topLeft.x *= scale;
            result.topRight.x *= scale;
        }
        const bottomSum = result.bottomLeft.x + result.bottomRight.x;
        if (bottomSum > safeWidth && bottomSum > 0) {
            const scale = safeWidth / bottomSum;
            result.bottomLeft.x *= scale;
            result.bottomRight.x *= scale;
        }
    }

    if (safeHeight <= 0) {
        result.topLeft.y = 0;
        result.topRight.y = 0;
        result.bottomRight.y = 0;
        result.bottomLeft.y = 0;
    } else {
        const leftSum = result.topLeft.y + result.bottomLeft.y;
        if (leftSum > safeHeight && leftSum > 0) {
            const scale = safeHeight / leftSum;
            result.topLeft.y *= scale;
            result.bottomLeft.y *= scale;
        }
        const rightSum = result.topRight.y + result.bottomRight.y;
        if (rightSum > safeHeight && rightSum > 0) {
            const scale = safeHeight / rightSum;
            result.topRight.y *= scale;
            result.bottomRight.y *= scale;
        }
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
