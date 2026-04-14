import type { LayoutNode } from "../../../dom/node.js";
import type { LayoutContext } from "../../pipeline/strategy.js";
import type { FlexItemMetrics, FlexLine } from "./types.js";
import { refreshFlexItemSizes, recomputeLineMetrics } from "./line-builder.js";

export function relayoutFlexItemForMainSize(
  container: LayoutNode,
  item: FlexItemMetrics,
  context: LayoutContext,
  targetMainSize: number,
  isRow: boolean,
): void {
  if (!Number.isFinite(targetMainSize) || targetMainSize < 0) {
    return;
  }

  const prevContainerWidth = container.box.contentWidth;
  const prevContainerHeight = container.box.contentHeight;
  const targetContribution = targetMainSize + item.mainMarginStart + item.mainMarginEnd;

  let displayMutated = false;
  if (item.node.style.display !== item.effectiveDisplay) {
    item.node.style.display = item.effectiveDisplay;
    displayMutated = true;
  }

  try {
    if (isRow) {
      container.box.contentWidth = Math.max(0, targetContribution);
    } else {
      container.box.contentHeight = Math.max(0, targetContribution);
    }
    context.layoutChild(item.node);
  } finally {
    container.box.contentWidth = prevContainerWidth;
    container.box.contentHeight = prevContainerHeight;
    if (displayMutated) {
      item.node.style.display = item.originalDisplay;
    }
  }
}

export function distributeFlexGrowAcrossLines(
  lines: FlexLine[],
  container: LayoutNode,
  context: LayoutContext,
  containerMainSize: number,
  mainAxisGap: number,
  isRow: boolean,
): void {
  if (lines.length === 0 || !(containerMainSize > 0)) {
    return;
  }

  for (const line of lines) {
    const freeSpace = containerMainSize - line.mainSizeWithGaps;
    if (!(freeSpace > 0)) {
      continue;
    }
    const growItems = line.items.filter((item) => item.flexGrow > 0);
    const totalGrow = growItems.reduce((sum, item) => sum + item.flexGrow, 0);
    if (!(totalGrow > 0)) {
      continue;
    }

    for (const item of growItems) {
      const delta = (freeSpace * item.flexGrow) / totalGrow;
      const targetMainSize = Math.max(0, item.mainSize + delta);
      if (Math.abs(targetMainSize - item.mainSize) < 0.01) {
        continue;
      }
      relayoutFlexItemForMainSize(container, item, context, targetMainSize, isRow);
      refreshFlexItemSizes(item, isRow);
    }

    recomputeLineMetrics(line, mainAxisGap);
  }
}
