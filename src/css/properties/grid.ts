import type { NumericLength } from "../length.js";
import type { GapProperties } from "./gap.js";

export type GridAutoFlow = "row" | "column" | "row dense" | "column dense";

// Track size types (resolved, in pixels)
export interface FixedTrackSize {
    kind: "fixed";
    size: number;
}

export interface FlexTrackSize {
    kind: "flex";
    flex: number;
    min?: number;
    max?: number;
}

export interface AutoTrackSize {
    kind: "auto";
    min?: number;
    max?: number;
}

export type TrackSize = FixedTrackSize | FlexTrackSize | AutoTrackSize;

export interface RepeatTrackDefinition {
    kind: "repeat";
    count: number;
    track: TrackSize;
}

export interface AutoRepeatTrackDefinition {
    kind: "repeat-auto";
    mode: "auto-fit" | "auto-fill";
    track: TrackSize;
}

export type TrackDefinition = TrackSize | RepeatTrackDefinition | AutoRepeatTrackDefinition;

// Track size input types (with length units)
export interface FixedTrackSizeInput {
    kind: "fixed";
    size: NumericLength;
}

export interface FlexTrackSizeInput {
    kind: "flex";
    flex: number;
    min?: NumericLength;
    max?: NumericLength;
}

export interface AutoTrackSizeInput {
    kind: "auto";
    min?: NumericLength;
    max?: NumericLength;
}

export type TrackSizeInput = FixedTrackSizeInput | FlexTrackSizeInput | AutoTrackSizeInput;

export interface RepeatTrackDefinitionInput {
    kind: "repeat";
    count: number;
    track: TrackSizeInput;
}

export interface AutoRepeatTrackDefinitionInput {
    kind: "repeat-auto";
    mode: "auto-fit" | "auto-fill";
    track: TrackSizeInput;
}

export type TrackDefinitionInput = TrackSizeInput | RepeatTrackDefinitionInput | AutoRepeatTrackDefinitionInput;

/**
 * Grid layout CSS properties.
 * Handles CSS Grid container and item properties.
 * 
 * Extends GapProperties to inherit rowGap and columnGap,
 * following the DRY principle and enabling shared gap utilities.
 */
export interface GridProperties extends GapProperties {
    /** Column track definitions */
    trackListColumns: TrackDefinition[];

    /** Row track definitions */
    trackListRows: TrackDefinition[];

    /** Auto-placement flow direction */
    autoFlow: GridAutoFlow;

    // rowGap and columnGap are inherited from GapProperties
}
