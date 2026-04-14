import { LayoutNode } from "../../dom/node.js";
import { AlignItems, Display, JustifyContent } from "../../css/enums.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import { adjustForBoxSizing, containingBlock, resolveBoxMetrics, resolveWidthBlock } from "../utils/node-math.js";
import { resolveLength, isAutoLength } from "../../css/length.js";
import { GapCalculator, calculateTotalGap } from "../utils/gap-calculator.js";
import type { FlexItemMetrics, FlexLine } from "./flex/types.js";
import {
  blockifyFlexItemDisplay,
  allowsPreferredShrink,
  isRowDirection,
  isAutoMainSize,
  computePreferredInlineWidth,
  offsetLayoutSubtree,
  resolveInitialDimension,
  resolveFlexSize
} from "./flex/utils.js";
import { buildFlexLines, calculateLinesCrossSize } from "./flex/line-builder.js";
import { distributeFlexGrowAcrossLines } from "./flex/distributor.js";
import {
  resolveAlignContentLayout,
  resolveJustifySpacing,
  computeCrossOffset,
  resolveItemAlignment
} from "./flex/alignment.js";

export class FlexLayoutStrategy implements LayoutStrategy {
  private readonly supportedDisplays = new Set<Display>([Display.Flex, Display.InlineFlex]);

  canLayout(node: LayoutNode): boolean {
    return this.supportedDisplays.has(node.style.display);
  }

  layout(node: LayoutNode, context: LayoutContext): void {
    const cb = containingBlock(node, context.env.viewport);
    const containerRefs = { containerWidth: cb.width, containerHeight: cb.height };
    const isRow = isRowDirection(node.style.flexDirection);
    const cbMain = isRow ? cb.width : cb.height;
    const cbCross = isRow ? cb.height : cb.width;
    // Resolve box metrics (padding/border)
    const boxMetrics = resolveBoxMetrics(node, cb.width, cb.height);
    const hExtras = boxMetrics.paddingLeft + boxMetrics.paddingRight + boxMetrics.borderLeft + boxMetrics.borderRight;
    const vExtras = boxMetrics.paddingTop + boxMetrics.paddingBottom + boxMetrics.borderTop + boxMetrics.borderBottom;

    let specifiedMain = resolveFlexSize(isRow ? node.style.width : node.style.height, cbMain, cb.width, cb.height);
    let specifiedCross = resolveFlexSize(isRow ? node.style.height : node.style.width, cbCross, cb.width, cb.height);
    if (specifiedMain !== undefined) {
      specifiedMain = adjustForBoxSizing(specifiedMain, node.style.boxSizing, isRow ? hExtras : vExtras);
    }
    if (specifiedCross !== undefined) {
      specifiedCross = adjustForBoxSizing(specifiedCross, node.style.boxSizing, isRow ? vExtras : hExtras);
    }

    // Read gap properties for flex layout
    const rowGap = node.style.rowGap ?? 0;
    const columnGap = node.style.columnGap ?? 0;
    const gapCalculator = new GapCalculator({ rowGap, columnGap });
    const mainAxisGap = gapCalculator.getMainAxisGap(isRow);

    const defaultContentWidth = resolveWidthBlock(node, cb.width, cb.height);

    if (isRow) {
      node.box.contentWidth = resolveInitialDimension(specifiedMain, defaultContentWidth);
      node.box.contentHeight = resolveInitialDimension(specifiedCross, cbCross);
    } else {
      node.box.contentWidth = resolveInitialDimension(specifiedCross, defaultContentWidth);
      node.box.contentHeight = resolveInitialDimension(specifiedMain, cbMain);
    }

    node.box.borderBoxWidth =
      node.box.contentWidth +
      boxMetrics.paddingLeft +
      boxMetrics.paddingRight +
      boxMetrics.borderLeft +
      boxMetrics.borderRight;
    node.box.borderBoxHeight =
      node.box.contentHeight +
      boxMetrics.paddingTop +
      boxMetrics.paddingBottom +
      boxMetrics.borderTop +
      boxMetrics.borderBottom;
    node.box.scrollWidth = Math.max(node.box.scrollWidth, node.box.contentWidth);
    node.box.scrollHeight = Math.max(node.box.scrollHeight, node.box.contentHeight);

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
      const parentContentWidth = node.box.contentWidth;
      const parentContentHeight = node.box.contentHeight;

      try {
        const basisReference = isRow ? cb.width : cb.height;
        const basis = resolveFlexSize(child.style.flexBasis, basisReference, cb.width, cb.height);
        if (basis !== undefined) {
          if (isRow) {
            node.box.contentWidth = Math.max(0, basis);
          } else {
            node.box.contentHeight = Math.max(0, basis);
          }
        }
        context.layoutChild(child);
        node.box.contentWidth = parentContentWidth;
        node.box.contentHeight = parentContentHeight;

        const marginLeft = resolveLength(child.style.marginLeft, cb.width, { auto: "zero", ...containerRefs });
        const marginRight = resolveLength(child.style.marginRight, cb.width, { auto: "zero", ...containerRefs });
        const marginTop = resolveLength(child.style.marginTop, cb.height, { auto: "zero", ...containerRefs });
        const marginBottom = resolveLength(child.style.marginBottom, cb.height, { auto: "zero", ...containerRefs });

        const mainMarginStart = isRow ? marginLeft : marginTop;
        const mainMarginEnd = isRow ? marginRight : marginBottom;
        const crossMarginStart = isRow ? marginTop : marginLeft;
        const crossMarginEnd = isRow ? marginBottom : marginRight;

        let mainSize = isRow ? child.box.borderBoxWidth : child.box.borderBoxHeight;
        const hasExplicitFlexBasis = resolveFlexSize(child.style.flexBasis, isRow ? cb.width : cb.height, cb.width, cb.height) !== undefined;
        const childDisplay = blockifiedDisplay;
        const allowPreferredShrink = allowsPreferredShrink(originalDisplay, childDisplay);

        if (isRow && allowPreferredShrink && isAutoMainSize(child.style.width) && !hasExplicitFlexBasis) {
          const preferredContent = computePreferredInlineWidth(child);
          if (preferredContent !== undefined && preferredContent >= 0) {
            const minWidth =
              child.style.minWidth !== undefined
                ? resolveLength(child.style.minWidth, cb.width, { auto: "zero", ...containerRefs })
                : undefined;
            const maxWidth =
              child.style.maxWidth !== undefined
                ? resolveLength(child.style.maxWidth, cb.width, { auto: "reference", ...containerRefs })
                : undefined;
            let targetContentWidth = preferredContent;
            if (minWidth !== undefined) {
              targetContentWidth = Math.max(targetContentWidth, minWidth);
            }
            if (maxWidth !== undefined) {
              targetContentWidth = Math.min(targetContentWidth, maxWidth);
            }
            if (targetContentWidth < child.box.contentWidth) {
              const paddingLeft = resolveLength(child.style.paddingLeft, cb.width, { auto: "zero", ...containerRefs });
              const paddingRight = resolveLength(child.style.paddingRight, cb.width, { auto: "zero", ...containerRefs });
              const borderLeft = resolveLength(child.style.borderLeft, cb.width, { auto: "zero", ...containerRefs });
              const borderRight = resolveLength(child.style.borderRight, cb.width, { auto: "zero", ...containerRefs });
              child.box.contentWidth = targetContentWidth;
              child.box.borderBoxWidth = targetContentWidth + paddingLeft + paddingRight + borderLeft + borderRight;
              child.box.marginBoxWidth = child.box.borderBoxWidth + marginLeft + marginRight;
              child.box.scrollWidth = Math.max(child.box.scrollWidth, child.box.contentWidth);
              mainSize = child.box.borderBoxWidth;

              // Re-layout with corrected width so inline text positions are correct
              const prevW = node.box.contentWidth;
              node.box.contentWidth = child.box.borderBoxWidth + marginLeft + marginRight;
              context.layoutChild(child);
              node.box.contentWidth = prevW;
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
              const paddingLeft = resolveLength(child.style.paddingLeft, widthRef, { auto: "zero", ...containerRefs });
              const paddingRight = resolveLength(child.style.paddingRight, widthRef, { auto: "zero", ...containerRefs });
              const borderLeft = resolveLength(child.style.borderLeft, widthRef, { auto: "zero", ...containerRefs });
              const borderRight = resolveLength(child.style.borderRight, widthRef, { auto: "zero", ...containerRefs });
              const minWidth =
                child.style.minWidth !== undefined
                  ? resolveLength(child.style.minWidth, widthRef, { auto: "zero", ...containerRefs })
                  : undefined;
              const maxWidth =
                child.style.maxWidth !== undefined
                  ? resolveLength(child.style.maxWidth, widthRef, { auto: "reference", ...containerRefs })
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
          originalDisplay,
          effectiveDisplay: blockifiedDisplay,
          mainMarginStart,
          mainMarginEnd,
          crossMarginStart,
          crossMarginEnd,
          mainSize,
          crossSize,
          mainContribution,
          crossContribution,
          flexGrow: Math.max(0, child.style.flexGrow ?? 0),
          flexShrink: Math.max(0, child.style.flexShrink ?? 0),
        });

        totalMain += mainContribution;
        maxCrossContribution = Math.max(maxCrossContribution, crossContribution);
      } finally {
        node.box.contentWidth = parentContentWidth;
        node.box.contentHeight = parentContentHeight;
        if (displayMutated) {
          child.style.display = originalDisplay;
        }
      }
    }

    // Account for gaps in total main size
    const gapSpace = calculateTotalGap(mainAxisGap, items.length);
    let totalMainWithGaps = totalMain + gapSpace;
    const wrapEnabled = isRow && node.style.flexWrap;
    const crossAxisGap = gapCalculator.getCrossAxisGap(isRow);

    let containerMainSize: number;
    if (specifiedMain !== undefined) {
      containerMainSize = specifiedMain;
    } else if (isRow) {
      const reference = Number.isFinite(defaultContentWidth) && defaultContentWidth > 0 ? defaultContentWidth : totalMainWithGaps;
      containerMainSize = wrapEnabled ? reference : Math.max(reference, totalMainWithGaps);
    } else {
      // For column flex containers with auto height, use content-based sizing.
      // Falling back to containing block height incorrectly stretches the box
      // to the page/viewport height in HTML->PDF flow layouts.
      containerMainSize = totalMainWithGaps;
    }

    const lines = wrapEnabled ? buildFlexLines(items, containerMainSize, mainAxisGap) : [];
    if (wrapEnabled) {
      distributeFlexGrowAcrossLines(lines, node, context, containerMainSize, mainAxisGap, isRow);
    } else if (items.length > 0) {
      const singleLine: FlexLine = {
        items,
        mainSizeWithGaps: totalMainWithGaps,
        crossSize: maxCrossContribution,
      };
      distributeFlexGrowAcrossLines([singleLine], node, context, containerMainSize, mainAxisGap, isRow);
      totalMain = items.reduce((sum, item) => sum + item.mainContribution, 0);
      maxCrossContribution = items.reduce((max, item) => Math.max(max, item.crossContribution), 0);
      totalMainWithGaps = totalMain + gapSpace;
    }
    const wrappedCrossContribution = wrapEnabled ? calculateLinesCrossSize(lines, crossAxisGap) : 0;

    let containerCrossSize: number;
    if (specifiedCross !== undefined) {
      const measuredCross = wrapEnabled ? wrappedCrossContribution : maxCrossContribution;
      containerCrossSize = Math.max(specifiedCross, measuredCross);
    } else if (!isRow) {
      const referenceCross = Number.isFinite(defaultContentWidth) && defaultContentWidth > 0 ? defaultContentWidth : maxCrossContribution;
      containerCrossSize = Math.max(referenceCross, maxCrossContribution);
    } else {
      containerCrossSize = wrapEnabled ? wrappedCrossContribution : maxCrossContribution;
    }

    const minCrossValue = isRow ? node.style.minHeight : node.style.minWidth;
    const maxCrossValue = isRow ? node.style.maxHeight : node.style.maxWidth;
    const crossExtras = isRow ? vExtras : hExtras;
    const minCross = minCrossValue !== undefined
      ? adjustForBoxSizing(resolveLength(minCrossValue, cbCross, { auto: "zero", ...containerRefs }), node.style.boxSizing, crossExtras)
      : undefined;
    const maxCross = maxCrossValue !== undefined
      ? adjustForBoxSizing(resolveLength(maxCrossValue, cbCross, { auto: "reference", ...containerRefs }), node.style.boxSizing, crossExtras)
      : undefined;

    if (minCross !== undefined) {
      containerCrossSize = Math.max(containerCrossSize, minCross);
    }
    if (maxCross !== undefined) {
      containerCrossSize = Math.min(containerCrossSize, maxCross);
    }


    const justify = node.style.justifyContent ?? JustifyContent.FlexStart;
    const align = alignContainer;
    if (wrapEnabled) {
      const alignContent = node.style.alignContent;
      const crossLayout = resolveAlignContentLayout(lines, alignContent, containerCrossSize, crossAxisGap);
      let crossCursor = crossLayout.initialOffset;
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const lineCrossSize = crossLayout.lineCrossSizes[lineIndex] ?? line.crossSize;
        const freeSpaceAfterGaps = containerMainSize - line.mainSizeWithGaps;
        const { offset: initialOffset, gap: justifyGap } = resolveJustifySpacing(
          justify,
          freeSpaceAfterGaps,
          line.items.length,
        );

        let mainCursor = initialOffset;
        for (let index = 0; index < line.items.length; index++) {
          const item = line.items[index];
          const alignSelf = resolveItemAlignment(item.node.style.alignSelf, align);
          const crossOffset = computeCrossOffset(
            alignSelf,
            lineCrossSize,
            item.crossSize,
            item.crossMarginStart,
            item.crossMarginEnd,
          );

          const previousX = item.node.box.x;
          const previousY = item.node.box.y;
          item.node.box.x = boxMetrics.contentBoxX + mainCursor + item.mainMarginStart;
          item.node.box.y = boxMetrics.contentBoxY + crossCursor + crossOffset + item.crossMarginStart;
          offsetLayoutSubtree(item.node, item.node.box.x - previousX, item.node.box.y - previousY);

          mainCursor += item.mainContribution;
          if (index < line.items.length - 1) {
            mainCursor += mainAxisGap + justifyGap;
          }
        }

        crossCursor += lineCrossSize;
        if (lineIndex < lines.length - 1) {
          crossCursor += crossAxisGap + crossLayout.additionalGap;
        }
      }
    } else {
      // Calculate justify spacing based on free space AFTER accounting for gaps.
      // This makes gap additive with justify-content spacing (per CSS Flexbox spec).
      const freeSpaceAfterGaps = containerMainSize - totalMainWithGaps;
      const { offset: initialOffset, gap: justifyGap } = resolveJustifySpacing(justify, freeSpaceAfterGaps, items.length);

      let cursor = initialOffset;
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const alignSelf = resolveItemAlignment(item.node.style.alignSelf, align);
        const crossOffset = computeCrossOffset(alignSelf, containerCrossSize, item.crossSize, item.crossMarginStart, item.crossMarginEnd);

        const previousX = item.node.box.x;
        const previousY = item.node.box.y;
        if (isRow) {
          item.node.box.x = boxMetrics.contentBoxX + cursor + item.mainMarginStart;
          item.node.box.y = boxMetrics.contentBoxY + crossOffset + item.crossMarginStart;
        } else {
          item.node.box.x = boxMetrics.contentBoxX + crossOffset + item.crossMarginStart;
          item.node.box.y = boxMetrics.contentBoxY + cursor + item.mainMarginStart;
        }
        offsetLayoutSubtree(item.node, item.node.box.x - previousX, item.node.box.y - previousY);

        cursor += item.mainContribution;
        if (index < items.length - 1) {
          // Apply explicit gap PLUS justify spacing (additive per spec).
          cursor += mainAxisGap + justifyGap;
        }
      }
    }

    if (isRow) {
      node.box.contentWidth = containerMainSize;
      node.box.contentHeight = containerCrossSize;
    } else {
      node.box.contentWidth = containerCrossSize;
      node.box.contentHeight = containerMainSize;
    }

    node.box.borderBoxWidth =
      node.box.contentWidth +
      boxMetrics.paddingLeft +
      boxMetrics.paddingRight +
      boxMetrics.borderLeft +
      boxMetrics.borderRight;
    node.box.borderBoxHeight =
      node.box.contentHeight +
      boxMetrics.paddingTop +
      boxMetrics.paddingBottom +
      boxMetrics.borderTop +
      boxMetrics.borderBottom;
    node.box.scrollWidth = node.box.contentWidth;
    node.box.scrollHeight = node.box.contentHeight;
  }
}
