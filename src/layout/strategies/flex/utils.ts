import { Display } from "../../../css/enums.js";
import { isAutoLength, resolveLength } from "../../../css/length.js";
import type { LengthLike } from "../../../css/length.js";
import type { FlexDirection } from "../../../css/style.js";
import { LayoutNode } from "../../../dom/node.js";

export function blockifyFlexItemDisplay(display: Display): Display {
  switch (display) {
    case Display.Inline:
    case Display.InlineBlock:
      return Display.Block;
    case Display.InlineFlex:
      return Display.Flex;
    case Display.InlineGrid:
      return Display.Grid;
    case Display.InlineTable:
      return Display.Table;
    default:
      return display;
  }
}

export function allowsPreferredShrink(originalDisplay: Display, effectiveDisplay: Display): boolean {
  switch (effectiveDisplay) {
    case Display.Flex:
    case Display.InlineFlex:
    case Display.Grid:
    case Display.InlineGrid:
      return false;
    default:
      break;
  }
  if (effectiveDisplay === originalDisplay) {
    return true;
  }
  return originalDisplay === Display.Inline;
}

export function isRowDirection(direction: FlexDirection): boolean {
  return direction === "row" || direction === "row-reverse";
}

export function isAutoMainSize(value: LengthLike | undefined): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value === "number") {
    return false;
  }
  if (value === "auto") {
    return true;
  }
  return isAutoLength(value);
}

export function computePreferredInlineWidth(node: LayoutNode): number | undefined {
  let maxWidth = 0;
  node.walk((desc) => {
    if (desc.inlineRuns && desc.inlineRuns.length > 0) {
      const localMax = desc.inlineRuns.reduce(
        (max, run) => Math.max(max, run.lineWidth ?? run.width),
        0,
      );
      if (localMax > maxWidth) {
        maxWidth = localMax;
      }
      return;
    }
    if (!desc.lineBoxes || desc.lineBoxes.length === 0) {
      return;
    }
    for (const line of desc.lineBoxes) {
      if (!line) {
        continue;
      }
      const width = typeof line.width === "number" ? line.width : 0;
      if (width > maxWidth) {
        maxWidth = width;
      }
    }
  });
  return maxWidth > 0 ? maxWidth : undefined;
}

export function offsetLayoutSubtree(node: LayoutNode, deltaX: number, deltaY: number): void {
  if (deltaX === 0 && deltaY === 0) {
    return;
  }
  node.walk((desc) => {
    if (desc !== node) {
      desc.box.x += deltaX;
      desc.box.y += deltaY;
    }
    desc.box.baseline += deltaY;

    // Update inline runs if they exist
    if (desc.inlineRuns && desc.inlineRuns.length > 0) {
      for (const run of desc.inlineRuns) {
        run.startX += deltaX;
        run.baseline += deltaY;
      }
    }
  });
}

export function resolveInitialDimension(specified: number | undefined, fallback: number): number {
  if (specified !== undefined && Number.isFinite(specified)) {
    return Math.max(specified, 0);
  }
  if (Number.isFinite(fallback)) {
    return Math.max(fallback, 0);
  }
  return 0;
}

export function resolveFlexSize(
  value: LengthLike | undefined,
  reference: number,
  containerWidth: number = reference,
  containerHeight: number = reference,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return value;
  }
  if (value === "auto" || isAutoLength(value)) {
    return undefined;
  }
  return resolveLength(value, reference, { auto: "reference", containerWidth, containerHeight });
}
