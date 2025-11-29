/**
 * Gap calculation utilities for layout strategies.
 * Provides SOLID gap handling for grid, flex, and other layout modes.
 * 
 * This module follows the Single Responsibility Principle by focusing
 * solely on gap-related calculations, making it reusable across different
 * layout strategies.
 */

export interface GapConfig {
    /** Gap between rows (in pixels) */
    rowGap: number;

    /** Gap between columns (in pixels) */
    columnGap: number;
}

/**
 * Calculate total gap space for a given number of items in one direction.
 * 
 * Formula: gap × (itemCount - 1)
 * 
 * @param gap - Gap value in pixels
 * @param itemCount - Number of items
 * @returns Total gap space consumed (0 if itemCount <= 1 or gap <= 0)
 * 
 * @example
 * calculateTotalGap(10, 3) // returns 20 (2 gaps between 3 items)
 * calculateTotalGap(10, 1) // returns 0 (no gaps for single item)
 */
export function calculateTotalGap(gap: number, itemCount: number): number {
    if (itemCount <= 1 || gap <= 0) {
        return 0;
    }
    return gap * (itemCount - 1);
}

/**
 * Calculate available space after accounting for gaps.
 * 
 * @param totalSpace - Total available space in pixels
 * @param gap - Gap between items in pixels
 * @param itemCount - Number of items
 * @returns Available space for content (clamped to 0 minimum)
 * 
 * @example
 * calculateAvailableSpace(100, 10, 3) // returns 80 (100 - 20 gap)
 */
export function calculateAvailableSpace(
    totalSpace: number,
    gap: number,
    itemCount: number
): number {
    const totalGap = calculateTotalGap(gap, itemCount);
    return Math.max(0, totalSpace - totalGap);
}

/**
 * Calculate offsets for items with gaps in a single axis.
 * 
 * Returns the starting position of each item, accounting for gaps.
 * 
 * @param itemSizes - Array of item sizes in pixels
 * @param gap - Gap between items in pixels
 * @returns Array of offsets for each item
 * 
 * @example
 * calculateItemOffsets([50, 30, 40], 10)
 * // returns [0, 60, 100] (item1 at 0, item2 at 50+10, item3 at 50+10+30+10)
 */
export function calculateItemOffsets(
    itemSizes: number[],
    gap: number
): number[] {
    const offsets: number[] = [];
    let offset = 0;

    for (let i = 0; i < itemSizes.length; i++) {
        offsets.push(offset);
        offset += itemSizes[i];

        // Add gap after all items except the last
        if (i < itemSizes.length - 1) {
            offset += gap;
        }
    }

    return offsets;
}

/**
 * Calculate grid track offsets with gaps.
 * 
 * This is an alias for calculateItemOffsets with clearer naming for grid context.
 * 
 * @param trackSizes - Array of track sizes in pixels
 * @param gap - Gap between tracks in pixels
 * @returns Array of offsets for each track
 */
export function calculateTrackOffsets(
    trackSizes: number[],
    gap: number
): number[] {
    return calculateItemOffsets(trackSizes, gap);
}

/**
 * Gap calculator service for layout strategies.
 * 
 * This class provides a convenient interface for gap calculations
 * with awareness of layout direction (row vs column).
 * 
 * Follows the Dependency Inversion Principle - layout strategies
 * depend on this abstraction rather than implementing gap logic themselves.
 */
export class GapCalculator {
    constructor(private config: GapConfig) { }

    /**
     * Get gap for main axis based on direction.
     * 
     * @param isRow - True if main axis is horizontal (row), false for vertical (column)
     * @returns Gap value in pixels
     */
    getMainAxisGap(isRow: boolean): number {
        return isRow ? this.config.columnGap : this.config.rowGap;
    }

    /**
     * Get gap for cross axis based on direction.
     * 
     * @param isRow - True if main axis is horizontal (row), false for vertical (column)
     * @returns Gap value in pixels
     */
    getCrossAxisGap(isRow: boolean): number {
        return isRow ? this.config.rowGap : this.config.columnGap;
    }

    /**
     * Calculate total gap for main axis.
     * 
     * @param isRow - True if main axis is horizontal (row)
     * @param itemCount - Number of items in main axis
     * @returns Total gap space consumed in pixels
     */
    calculateMainAxisTotalGap(isRow: boolean, itemCount: number): number {
        const gap = this.getMainAxisGap(isRow);
        return calculateTotalGap(gap, itemCount);
    }

    /**
     * Calculate available space in main axis after gaps.
     * 
     * @param isRow - True if main axis is horizontal (row)
     * @param totalSpace - Total available space in pixels
     * @param itemCount - Number of items in main axis
     * @returns Available space for content in pixels
     */
    calculateMainAxisAvailableSpace(
        isRow: boolean,
        totalSpace: number,
        itemCount: number
    ): number {
        const gap = this.getMainAxisGap(isRow);
        return calculateAvailableSpace(totalSpace, gap, itemCount);
    }
}
