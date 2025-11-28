import { FloatMode, ClearMode, TableLayoutMode, BorderModel } from "../enums.js";
import { CustomPropertiesMap } from "../custom-properties.js";

/**
 * Miscellaneous CSS properties.
 * Handles specialized properties like float, list styling, table layout, and page breaks.
 */
export interface MiscProperties {
    /** Float positioning */
    float: FloatMode;

    /** Clear float behavior */
    clear: ClearMode;

    /** List item marker type */
    listStyleType: string;

    /** Image/video object-fit mode */
    objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";

    /** Table layout algorithm */
    tableLayout: TableLayoutMode;

    /** Table border model (separate or collapse) */
    borderModel: BorderModel;

    /** Page break before element */
    breakBefore: string;

    /** Page break after element */
    breakAfter: string;

    /** Page break inside element */
    breakInside: string;

    /** Minimum lines at bottom of page/column */
    widows: number;

    /** Minimum lines at top of page/column */
    orphans: number;

    /** CSS Custom Properties (Variables) */
    customProperties?: CustomPropertiesMap;
}
