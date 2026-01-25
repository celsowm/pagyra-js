import type { Display } from "../enums.js";
import type { LineHeightValue } from "../line-height.js";
import type { NumericLength } from "../length.js";
import type { StyleProperties } from "../style.js";

// Narrow UA defaults contract for element-level mappings.
// Kept small on purpose: only what ElementSpecificDefaults / BrowserDefaults need.
export interface ElementDefaults {
  tagName: string;
  display: Display;
  margin?: NumericLength;
  marginTop?: NumericLength;
  marginRight?: NumericLength;
  marginBottom?: NumericLength;
  marginLeft?: NumericLength;
  padding?: NumericLength;
  paddingTop?: NumericLength;
  paddingRight?: NumericLength;
  paddingBottom?: NumericLength;
  paddingLeft?: NumericLength;
  border?: NumericLength;
  borderTop?: NumericLength;
  borderRight?: NumericLength;
  borderBottom?: NumericLength;
  borderLeft?: NumericLength;
  fontSize: NumericLength;
  fontStyle?: string;
  lineHeight: LineHeightValue;
  fontFamily: string;
  fontWeight: number;
  color: string;
  borderColor?: string;
  listStyleType?: string;
  textAlign?: string;
  textIndent?: number;
  verticalAlign?: string;
  borderCollapse?: string;
  borderSpacing?: number;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  textDecorationLine?: string;
  textDecorationColor?: string;
  textDecorationStyle?: string;
  overflowWrap?: "normal" | "break-word" | "anywhere";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
}

export type StyleDefaults = Partial<Omit<StyleProperties,
  | "fontSize"
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "borderTop"
  | "borderRight"
  | "borderBottom"
  | "borderLeft"
>> & {
  fontSize?: NumericLength;
  marginTop?: NumericLength;
  marginRight?: NumericLength;
  marginBottom?: NumericLength;
  marginLeft?: NumericLength;
  paddingTop?: NumericLength;
  paddingRight?: NumericLength;
  paddingBottom?: NumericLength;
  paddingLeft?: NumericLength;
  borderTop?: NumericLength;
  borderRight?: NumericLength;
  borderBottom?: NumericLength;
  borderLeft?: NumericLength;
};
