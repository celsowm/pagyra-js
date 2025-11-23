import { LayoutNode } from "../../dom/node.js";
import { AlignItems, Display, JustifyContent } from "../../css/enums.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import { containingBlock } from "../utils/node-math.js";
import { resolveLength, isAutoLength } from "../../css/length.js";
import type { LengthLike } from "../../css/length.js";
import type { FlexDirection, AlignSelfValue } from "../../css/style.js";

function blockifyFlexItemDisplay(display: Display): Display {
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

function allowsPreferredShrink(originalDisplay: Display, effectiveDisplay: Display): boolean {
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

export class FlexLayoutStrategy implements LayoutStrategy {
  private readonly supportedDisplays = new Set<Display>([Display.Flex, Display.InlineFlex]);

  canLayout(node: LayoutNode): boolean {
    return this.supportedDisplays.has(node.style.display);
  }

  layout(node: LayoutNode, context: LayoutContext): void {
    const cb = containingBlock(node, context.env.viewport);
    const isRow = isRowDirection(node.style.flexDirection);
    const cbMain = isRow ? cb.width : cb.height;
    const cbCross = isRow ? cb.height : cb.width;
    const specifiedMain = resolveFlexSize(isRow ? node.style.width : node.style.height, cbMain);
    const specifiedCross = resolveFlexSize(isRow ? node.style.height : node.style.width, cbCross);

    if (isRow) {
      node.box.contentWidth = resolveInitialDimension(specifiedMain, cbMain);
      node.box.contentHeight = resolveInitialDimension(specifiedCross, cbCross);
    } else {
      node.box.contentWidth = resolveInitialDimension(specifiedCross, cbCross);
      node.box.contentHeight = resolveInitialDimension(specifiedMain, cbMain);
    }

    node.box.borderBoxWidth = node.box.contentWidth;
    node.box.borderBoxHeight = node.box.contentHeight;
    node.box.scrollWidth = Math.max(node.box.scrollWidth, node.box.contentWidth);
    node.box.scrollHeight = Math.max(node.box.scrollHeight, node.box.contentHeight);

    interface FlexItemMetrics {
      node: LayoutNode;
      mainMarginStart: number;
      mainMarginEnd: number;
      crossMarginStart: number;
      crossMarginEnd: number;
      mainSize: number;
      crossSize: number;
      mainContribution: number;
      crossContribution: number;
    }

    const alignContainer = node.style.alignItems ?? AlignItems.Stretch;
    const items: FlexItemMetrics[] = [];
    let totalMain = 0;
    let maxCrossContribution = 0;

    for (const child of node.children) {
      if (child.style.display === Display.None) {
        continue;
      }

      const originalDisplay = child.style.display;
      const blockifiedDisplay = blockifyFlexItemDisplay(originalDisplay);
      const displayMutated = blockifiedDisplay !== originalDisplay;
      if (displayMutated) {
        child.style.display = blockifiedDisplay;
      }

      try {
        context.layoutChild(child);

        const marginLeft = resolveLength(child.style.marginLeft, cb.width, { auto: "zero" });
        const marginRight = resolveLength(child.style.marginRight, cb.width, { auto: "zero" });
        const marginTop = resolveLength(child.style.marginTop, cb.height, { auto: "zero" });
        const marginBottom = resolveLength(child.style.marginBottom, cb.height, { auto: "zero" });

        const mainMarginStart = isRow ? marginLeft : marginTop;
        const mainMarginEnd = isRow ? marginRight : marginBottom;
        const crossMarginStart = isRow ? marginTop : marginLeft;
        const crossMarginEnd = isRow ? marginBottom : marginRight;

        let mainSize = isRow ? child.box.borderBoxWidth : child.box.borderBoxHeight;
        const childDisplay = blockifiedDisplay;
        const allowPreferredShrink = allowsPreferredShrink(originalDisplay, childDisplay);

        if (isRow && allowPreferredShrink && isAutoMainSize(child.style.width)) {
          const preferredContent = computePreferredInlineWidth(child);
          if (preferredContent !== undefined && preferredContent >= 0) {
            const minWidth =
              child.style.minWidth !== undefined
                ? resolveLength(child.style.minWidth, cb.width, { auto: "zero" })
                : undefined;
            const maxWidth =
              child.style.maxWidth !== undefined
                ? resolveLength(child.style.maxWidth, cb.width, { auto: "reference" })
                : undefined;
            let targetContentWidth = preferredContent;
            if (minWidth !== undefined) {
              targetContentWidth = Math.max(targetContentWidth, minWidth);
            }
            if (maxWidth !== undefined) {
              targetContentWidth = Math.min(targetContentWidth, maxWidth);
            }
            if (targetContentWidth < child.box.contentWidth) {
              const paddingLeft = resolveLength(child.style.paddingLeft, cb.width, { auto: "zero" });
              const paddingRight = resolveLength(child.style.paddingRight, cb.width, { auto: "zero" });
              const borderLeft = resolveLength(child.style.borderLeft, cb.width, { auto: "zero" });
              const borderRight = resolveLength(child.style.borderRight, cb.width, { auto: "zero" });
              child.box.contentWidth = targetContentWidth;
              child.box.borderBoxWidth = targetContentWidth + paddingLeft + paddingRight + borderLeft + borderRight;
              child.box.marginBoxWidth = child.box.borderBoxWidth + marginLeft + marginRight;
              child.box.scrollWidth = Math.max(child.box.scrollWidth, child.box.contentWidth);
              mainSize = child.box.borderBoxWidth;
            }
          }
        }

        let crossSize = isRow ? child.box.borderBoxHeight : child.box.borderBoxWidth;
        if (!isRow && allowPreferredShrink) {
          const alignSelf = resolveItemAlignment(child.style.alignSelf, alignContainer);
          const autoWidth = isAutoLength(child.style.width);
          if (alignSelf !== AlignItems.Stretch && autoWidth) {
            const preferredContent = computePreferredInlineWidth(child);
            if (preferredContent !== undefined && preferredContent > 0) {
              const widthRef = cb.width;
              const paddingLeft = resolveLength(child.style.paddingLeft, widthRef, { auto: "zero" });
              const paddingRight = resolveLength(child.style.paddingRight, widthRef, { auto: "zero" });
              const borderLeft = resolveLength(child.style.borderLeft, widthRef, { auto: "zero" });
              const borderRight = resolveLength(child.style.borderRight, widthRef, { auto: "zero" });
              const minWidth =
                child.style.minWidth !== undefined
                  ? resolveLength(child.style.minWidth, widthRef, { auto: "zero" })
                  : undefined;
              const maxWidth =
                child.style.maxWidth !== undefined
                  ? resolveLength(child.style.maxWidth, widthRef, { auto: "reference" })
                  : undefined;
              let targetContentWidth = Math.min(preferredContent, child.box.contentWidth);
              if (minWidth !== undefined) {
                targetContentWidth = Math.max(targetContentWidth, minWidth);
              }
              if (maxWidth !== undefined) {
                targetContentWidth = Math.min(targetContentWidth, maxWidth);
              }
              targetContentWidth = Math.max(0, targetContentWidth);
              if (targetContentWidth < child.box.contentWidth) {
                child.box.contentWidth = targetContentWidth;
                const horizontalExtras = paddingLeft + paddingRight + borderLeft + borderRight;
                const newBorderBoxWidth = targetContentWidth + horizontalExtras;
                child.box.borderBoxWidth = newBorderBoxWidth;
                child.box.marginBoxWidth = newBorderBoxWidth + marginLeft + marginRight;
                child.box.scrollWidth = Math.max(child.box.scrollWidth, targetContentWidth);
                crossSize = newBorderBoxWidth;
              }
            }
          }
        }
        const mainContribution = mainSize + mainMarginStart + mainMarginEnd;
        const crossContribution = crossSize + crossMarginStart + crossMarginEnd;

        items.push({
          node: child,
          mainMarginStart,
          mainMarginEnd,
          crossMarginStart,
          crossMarginEnd,
          mainSize,
          crossSize,
          mainContribution,
          crossContribution,
        });

        totalMain += mainContribution;
        maxCrossContribution = Math.max(maxCrossContribution, crossContribution);
      } finally {
        if (displayMutated) {
          child.style.display = originalDisplay;
        }
      }
    }

    let containerMainSize: number;
    if (specifiedMain !== undefined) {
      containerMainSize = specifiedMain;
    } else {
      const reference = Number.isFinite(cbMain) && cbMain > 0 ? cbMain : totalMain;
      containerMainSize = Math.max(reference, totalMain);
    }

    let containerCrossSize: number;
    if (specifiedCross !== undefined) {
      containerCrossSize = Math.max(specifiedCross, maxCrossContribution);
    } else if (!isRow) {
      const referenceCross = Number.isFinite(cbCross) && cbCross > 0 ? cbCross : maxCrossContribution;
      containerCrossSize = Math.max(referenceCross, maxCrossContribution);
    } else {
      containerCrossSize = maxCrossContribution;
    }

    const minCrossValue = isRow ? node.style.minHeight : node.style.minWidth;
    const maxCrossValue = isRow ? node.style.maxHeight : node.style.maxWidth;
    const minCross = minCrossValue !== undefined ? resolveLength(minCrossValue, cbCross, { auto: "zero" }) : undefined;
    const maxCross = maxCrossValue !== undefined ? resolveLength(maxCrossValue, cbCross, { auto: "reference" }) : undefined;

    if (minCross !== undefined) {
      containerCrossSize = Math.max(containerCrossSize, minCross);
    }
    if (maxCross !== undefined) {
      containerCrossSize = Math.min(containerCrossSize, maxCross);
    }


    const justify = node.style.justifyContent ?? JustifyContent.FlexStart;
    const align = alignContainer;
    const { offset: initialOffset, gap } = resolveJustifySpacing(justify, containerMainSize - totalMain, items.length);

    let cursor = initialOffset;

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const alignSelf = resolveItemAlignment(item.node.style.alignSelf, align);
      const crossOffset = computeCrossOffset(alignSelf, containerCrossSize, item.crossSize, item.crossMarginStart, item.crossMarginEnd);

      const previousX = item.node.box.x;
      const previousY = item.node.box.y;
      if (isRow) {
        item.node.box.x = node.box.x + cursor + item.mainMarginStart;
        item.node.box.y = node.box.y + crossOffset + item.crossMarginStart;
      } else {
        item.node.box.x = node.box.x + crossOffset + item.crossMarginStart;
        item.node.box.y = node.box.y + cursor + item.mainMarginStart;
      }
      offsetLayoutSubtree(item.node, item.node.box.x - previousX, item.node.box.y - previousY);

      cursor += item.mainContribution;
      if (index < items.length - 1) {
        cursor += gap;
      }
    }

    if (isRow) {
      node.box.contentWidth = containerMainSize;
      node.box.contentHeight = containerCrossSize;
    } else {
      node.box.contentWidth = containerCrossSize;
      node.box.contentHeight = containerMainSize;
    }

    node.box.borderBoxWidth = node.box.contentWidth;
    node.box.borderBoxHeight = node.box.contentHeight;
    node.box.scrollWidth = node.box.contentWidth;
    node.box.scrollHeight = node.box.contentHeight;
  }
}

function resolveInitialDimension(specified: number | undefined, fallback: number): number {
  if (specified !== undefined && Number.isFinite(specified)) {
    return Math.max(specified, 0);
  }
  if (Number.isFinite(fallback)) {
    return Math.max(fallback, 0);
  }
  return 0;
}

function resolveFlexSize(value: LengthLike | undefined, reference: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return value;
  }
  if (value === "auto" || isAutoLength(value)) {
    return undefined;
  }
  return resolveLength(value, reference, { auto: "reference" });
}

function resolveItemAlignment(alignSelf: AlignSelfValue | undefined, containerAlign: AlignItems): AlignItems {
  if (alignSelf && alignSelf !== "auto") {
    return alignSelf;
  }
  return containerAlign;
}

function computeCrossOffset(
  alignment: AlignItems,
  containerSize: number,
  itemSize: number,
  marginStart: number,
  marginEnd: number,
): number {
  const total = itemSize + marginStart + marginEnd;
  const reference = Number.isFinite(containerSize) ? containerSize : total;
  const freeSpace = reference - total;
  if (freeSpace <= 0) {
    return 0;
  }
  switch (alignment) {
    case AlignItems.Center:
      return freeSpace / 2;
    case AlignItems.FlexEnd:
      return freeSpace;
    default:
      return 0;
  }
}

function resolveJustifySpacing(
  justify: JustifyContent,
  freeSpace: number,
  itemCount: number,
): { offset: number; gap: number } {
  if (itemCount <= 0) {
    return { offset: 0, gap: 0 };
  }
  const clamped = Number.isFinite(freeSpace) ? Math.max(freeSpace, 0) : 0;
  switch (justify) {
    case JustifyContent.Center:
      return { offset: clamped / 2, gap: 0 };
    case JustifyContent.FlexEnd:
    case JustifyContent.End:
    case JustifyContent.Right:
      return { offset: clamped, gap: 0 };
    case JustifyContent.SpaceBetween:
      if (itemCount === 1) {
        return { offset: 0, gap: 0 };
      }
      return { offset: 0, gap: clamped / (itemCount - 1) };
    case JustifyContent.SpaceAround: {
      const gap = clamped / itemCount;
      return { offset: gap / 2, gap };
    }
    case JustifyContent.SpaceEvenly: {
      const gap = clamped / (itemCount + 1);
      return { offset: gap, gap };
    }
    default:
      return { offset: 0, gap: 0 };
  }
}

function isRowDirection(direction: FlexDirection): boolean {
  return direction === "row" || direction === "row-reverse";
}

function isAutoMainSize(value: LengthLike | undefined): boolean {
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

function computePreferredInlineWidth(node: LayoutNode): number | undefined {
  let maxWidth = 0;
  node.walk((desc) => {
    if (desc.inlineRuns && desc.inlineRuns.length > 0) {
      const localMax = desc.inlineRuns.reduce((max, run) => Math.max(max, run.width), 0);
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

function offsetLayoutSubtree(node: LayoutNode, deltaX: number, deltaY: number): void {
  if (deltaX === 0 && deltaY === 0) {
    return;
  }
  node.walk((desc) => {
    if (desc === node) {
      return;
    }
    desc.box.x += deltaX;
    desc.box.y += deltaY;
    desc.box.baseline += deltaY;
  });
}
