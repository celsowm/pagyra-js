import type { FlexItemMetrics, FlexLine } from "./types.js";
import { calculateTotalGap } from "../../utils/gap-calculator.js";

export function buildFlexLines(items: FlexItemMetrics[], containerMainSize: number, mainAxisGap: number): FlexLine[] {
  if (items.length === 0) {
    return [];
  }

  const lines: FlexLine[] = [];
  let current: FlexLine = { items: [], mainSizeWithGaps: 0, crossSize: 0 };

  for (const item of items) {
    const addition =
      current.items.length === 0 ? item.mainContribution : mainAxisGap + item.mainContribution;
    const shouldWrap =
      current.items.length > 0 &&
      containerMainSize > 0 &&
      current.mainSizeWithGaps + addition > containerMainSize + 0.01;

    if (shouldWrap) {
      lines.push(current);
      current = { items: [], mainSizeWithGaps: 0, crossSize: 0 };
    }

    if (current.items.length > 0) {
      current.mainSizeWithGaps += mainAxisGap;
    }
    current.items.push(item);
    current.mainSizeWithGaps += item.mainContribution;
    current.crossSize = Math.max(current.crossSize, item.crossContribution);
  }

  if (current.items.length > 0) {
    lines.push(current);
  }

  return lines;
}

export function calculateLinesCrossSize(lines: FlexLine[], crossAxisGap: number): number {
  if (lines.length === 0) {
    return 0;
  }
  const totalLines = lines.reduce((sum, line) => sum + line.crossSize, 0);
  return totalLines + calculateTotalGap(crossAxisGap, lines.length);
}

export function refreshFlexItemSizes(item: FlexItemMetrics, isRow: boolean): void {
  item.mainSize = isRow ? item.node.box.borderBoxWidth : item.node.box.borderBoxHeight;
  item.crossSize = isRow ? item.node.box.borderBoxHeight : item.node.box.borderBoxWidth;
  item.mainContribution = item.mainSize + item.mainMarginStart + item.mainMarginEnd;
  item.crossContribution = item.crossSize + item.crossMarginStart + item.crossMarginEnd;
}

export function recomputeLineMetrics(line: FlexLine, mainAxisGap: number): void {
  let mainSizeWithGaps = 0;
  let crossSize = 0;
  for (let i = 0; i < line.items.length; i++) {
    const item = line.items[i];
    if (i > 0) {
      mainSizeWithGaps += mainAxisGap;
    }
    mainSizeWithGaps += item.mainContribution;
    crossSize = Math.max(crossSize, item.crossContribution);
  }
  line.mainSizeWithGaps = mainSizeWithGaps;
  line.crossSize = crossSize;
}
