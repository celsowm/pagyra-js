import type { Display } from "../enums.js";

// Narrow UA defaults contract for element-level mappings.
// Kept small on purpose: only what ElementSpecificDefaults / BrowserDefaults need.
export interface ElementDefaults {
  tagName: string;
  display: Display;
  margin?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  border?: number;
  borderTop?: number;
  borderRight?: number;
  borderBottom?: number;
  borderLeft?: number;
  fontSize: number;
  fontStyle?: string;
  lineHeight: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  borderColor?: string;
  listStyleType?: string;
  textAlign?: string;
  verticalAlign?: string;
  borderCollapse?: string;
  borderSpacing?: number;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  textDecorationLine?: string;
}
