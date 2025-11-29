/**
 * Gap properties for layout containers (Grid, Flex, etc.)
 * Defines spacing between child items in a container.
 * 
 * These properties are shared across multiple layout modes to follow
 * the DRY principle and maintain consistency.
 */
export interface GapProperties {
    /** Gap between rows (in pixels) */
    rowGap: number;

    /** Gap between columns or items in row direction (in pixels) */
    columnGap: number;
}
