import type { LengthLike } from "../length.js";
import { AlignItems, AlignContent, JustifyContent } from "../enums.js";
import type { GapProperties } from "./gap.js";

export type FlexDirection = "row" | "row-reverse" | "column" | "column-reverse";
export type AlignSelfValue = AlignItems | "auto";

/**
 * Flexbox layout CSS properties.
 * Handles flex container and flex item properties.
 * 
 * Extends GapProperties to inherit rowGap and columnGap,
 * enabling proper gap support in flex layouts as per modern CSS Flexbox spec.
 */
export interface FlexboxProperties extends GapProperties {
    /** Flex container direction */
    flexDirection: FlexDirection;

    /** Whether flex items wrap */
    flexWrap: boolean;

    /** Flex grow factor */
    flexGrow: number;

    /** Flex shrink factor */
    flexShrink: number;

    /** Flex basis (initial size) */
    flexBasis: LengthLike;

    /** Main axis alignment */
    justifyContent: JustifyContent;

    /** Cross axis alignment for items */
    alignItems: AlignItems;

    /** Cross axis alignment for lines */
    alignContent: AlignContent;

    /** Individual item alignment override */
    alignSelf: AlignSelfValue;

    // rowGap and columnGap are inherited from GapProperties
}
