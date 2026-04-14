import { Display } from "../../../css/enums.js";
import { LayoutNode } from "../../../dom/node.js";

export interface FlexItemMetrics {
  node: LayoutNode;
  originalDisplay: Display;
  effectiveDisplay: Display;
  mainMarginStart: number;
  mainMarginEnd: number;
  crossMarginStart: number;
  crossMarginEnd: number;
  mainSize: number;
  crossSize: number;
  mainContribution: number;
  crossContribution: number;
  flexGrow: number;
  flexShrink: number;
}

export interface FlexLine {
  items: FlexItemMetrics[];
  // Includes item contributions and explicit main-axis gaps between items.
  mainSizeWithGaps: number;
  // Max cross contribution among line items.
  crossSize: number;
}

export interface AlignContentResolution {
  lineCrossSizes: number[];
  initialOffset: number;
  additionalGap: number;
}
