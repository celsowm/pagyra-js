import { FloatMode, ClearMode, TableLayoutMode, BorderModel } from "../enums.js";
import { CustomPropertiesMap } from "../custom-properties.js";
import type { CounterIncrement, CounterReset } from "../../layout/counter.js";

export interface ObjectPosition {
    /** Horizontal alignment ratio: 0 = left, 0.5 = center, 1 = right. */
    x: number;
    /** Vertical alignment ratio: 0 = top, 0.5 = center, 1 = bottom. */
    y: number;
}

/** Miscellaneous CSS properties. */
export interface MiscProperties {
    float: FloatMode;
    clear: ClearMode;
    listStyleType: string;
    objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
    objectPosition?: ObjectPosition;
    tableLayout: TableLayoutMode;
    borderModel: BorderModel;
    breakBefore: string;
    breakAfter: string;
    breakInside: string;
    widows: number;
    orphans: number;
    customProperties?: CustomPropertiesMap;
    counterReset?: CounterReset[];
    counterIncrement?: CounterIncrement[];
}
