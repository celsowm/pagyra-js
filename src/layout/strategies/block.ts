import { LayoutNode } from "../../dom/node.js";
import { Display, FloatMode } from "../../css/enums.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import {
  adjustForBoxSizing,
  containingBlock,
  establishesBFC,
  horizontalNonContent,
  horizontalMargin,
  inFlow,
  resolveBlockAutoMargins,
  resolveWidthBlock,
  verticalNonContent,
} from "../utils/node-math.js";
import { resolveLength } from "../../css/length.js";
import {
  canCollapseMarginEnd,
  canCollapseMarginStart,
  collapsedGapBetween,
  effectiveMarginBottom,
  effectiveMarginTop,
  findFirstMarginCollapsibleChild,
  findLastMarginCollapsibleChild,
} from "../utils/margin.js";
import { finalizeOverflow } from "../utils/overflow.js";
import { FloatContext } from "../context/float-context.js";
import { clearForBlock, placeFloat } from "../utils/floats.js";
import { defaultInlineFormatter } from "../utils/inline-formatter.js";
import { isInlineLevel } from "../utils/display-utils.js";
import { ContentMeasurer } from "../utils/content-measurer.js";
import { createLayoutDebug } from "../debug.js";

export class BlockLayoutStrategy implements LayoutStrategy {
  private readonly supportedDisplays = new Set<Display>([Display.Block, Display.FlowRoot, Display.InlineBlock, Display.TableCell]);

  canLayout(node: LayoutNode): boolean {
    return this.supportedDisplays.has(node.style.display);
  }

  layout(node: LayoutNode, context: LayoutContext): void {
    const layoutDebug = createLayoutDebug(context);
    const contentMeasurer = new ContentMeasurer(layoutDebug);
    const cb = containingBlock(node, context.env.viewport);
    const containerRefs = { containerWidth: cb.width, containerHeight: cb.height };
    node.establishesBFC = establishesBFC(node);

    let contentWidth = resolveWidthBlock(node, cb.width, cb.height);
    const debugTag = node.tagName ?? "(anonymous)";
    if (node.style.display === Display.InlineBlock) {
      layoutDebug(
        `[BlockLayout] start inline-block tag=${debugTag} style.width=${node.style.width} resolvedContentWidth=${contentWidth} cb.width=${cb.width}`,
      );
    }
    const availableWidth = contentWidth;
    node.box.contentWidth = contentWidth;

    const horizontalExtras = horizontalNonContent(node, contentWidth, cb.height);
    const horizontalMarginSize = horizontalMargin(node, contentWidth, cb.height);
    node.box.borderBoxWidth = contentWidth + horizontalExtras;
    node.box.marginBoxWidth = node.box.borderBoxWidth + horizontalMarginSize;

    const paddingLeft = resolveLength(node.style.paddingLeft, contentWidth, { auto: "zero", ...containerRefs });
    const borderLeft = resolveLength(node.style.borderLeft, contentWidth, { auto: "zero", ...containerRefs });
    const paddingTop = resolveLength(node.style.paddingTop, contentWidth, { auto: "zero", ...containerRefs });
    const borderTop = resolveLength(node.style.borderTop, contentWidth, { auto: "zero", ...containerRefs });

    const contentX = node.box.x + borderLeft + paddingLeft;
    const collapseTopWithChildren = canCollapseMarginStart(node, contentWidth, cb.height);
    const collapseBottomWithChildren = canCollapseMarginEnd(node, contentWidth, cb.height);
    const firstCollapsibleChild = collapseTopWithChildren ? findFirstMarginCollapsibleChild(node) : undefined;
    const lastCollapsibleChild = collapseBottomWithChildren ? findLastMarginCollapsibleChild(node) : undefined;
    const topCollapseAmount =
      collapseTopWithChildren && firstCollapsibleChild ? effectiveMarginTop(firstCollapsibleChild, contentWidth, cb.height) : 0;
    const bottomCollapseAmount =
      collapseBottomWithChildren && lastCollapsibleChild ? effectiveMarginBottom(lastCollapsibleChild, contentWidth, cb.height) : 0;

    let cursorY = node.box.y + paddingTop + borderTop;
    let previousBottomMargin = 0;
    const floatContext = new FloatContext();
    const children = node.children;

    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      if (child.style.display === Display.None) {
        continue;
      }

      if (child.style.float !== FloatMode.None) {
        cursorY = clearForBlock(child, floatContext, cursorY);
        placeFloat({
          node: child,
          floatContext,
          context,
          contentX,
          contentWidth,
          contentHeight: cb.height,
          startY: cursorY,
        });
        previousBottomMargin = 0;
        continue;
      }

      if (!inFlow(child)) {
        continue;
      }

      if (isInlineLevel(child)) {
        const inlineNodes: LayoutNode[] = [child];
        let lookahead = index + 1;
        while (lookahead < children.length) {
          const candidate = children[lookahead];
          if (candidate.style.float !== FloatMode.None || !isInlineLevel(candidate)) {
            break;
          }
          inlineNodes.push(candidate);
          lookahead += 1;
        }

        const result = defaultInlineFormatter.layout({
          container: node,
          inlineNodes,
          context,
          floatContext,
          contentX,
          contentWidth,
          startY: cursorY,
        });
        cursorY = result.newCursorY;
        previousBottomMargin = 0;
        index = lookahead - 1;
        continue;
      }

      const childMarginTopRaw = resolveLength(child.style.marginTop, contentWidth, { auto: "zero", ...containerRefs });
      const childMarginBottomRaw = resolveLength(child.style.marginBottom, contentWidth, { auto: "zero", ...containerRefs });
      const collapsedMarginTop = effectiveMarginTop(child, contentWidth, cb.height);
      const collapsedMarginBottom = effectiveMarginBottom(child, contentWidth, cb.height);

      let gap = collapsedGapBetween(previousBottomMargin, collapsedMarginTop, node.establishesBFC);
      if (collapseTopWithChildren && child === firstCollapsibleChild) {
        gap -= topCollapseAmount;
      }

      child.box.x = contentX;
      child.box.y = cursorY + gap;

      context.layoutChild(child);

      const { marginLeft: usedMarginLeft, marginRight: usedMarginRight } = resolveBlockAutoMargins(
        contentWidth,
        child.box.borderBoxWidth,
        child.style.marginLeft,
        child.style.marginRight,
        cb.height,
      );
      child.box.usedMarginLeft = usedMarginLeft;
      child.box.usedMarginRight = usedMarginRight;
      const deltaX = usedMarginLeft;
      if (deltaX !== 0) {
        child.shift(deltaX, 0);
      }
      child.box.x = contentX + usedMarginLeft;

      child.box.marginBoxWidth = child.box.borderBoxWidth + usedMarginLeft + usedMarginRight;
      child.box.marginBoxHeight = child.box.borderBoxHeight + childMarginTopRaw + childMarginBottomRaw;

      previousBottomMargin = collapsedMarginBottom;

      cursorY = child.box.y + child.box.borderBoxHeight;

      if (collapseBottomWithChildren && child === lastCollapsibleChild) {
        cursorY += collapsedMarginBottom - bottomCollapseAmount;
        previousBottomMargin = 0;
      }
    }

    // When the parent cannot collapse its bottom margin with children
    // (e.g. it has border-bottom or padding-bottom), the last child's
    // bottom margin is contained inside the parent and must be included
    // in the content height.
    if (!collapseBottomWithChildren && previousBottomMargin !== 0) {
      cursorY += previousBottomMargin;
    }

    const measurement = contentMeasurer.measureInFlowWidth(node, contentWidth, contentX, cb.height);
    if (Number.isFinite(measurement.width)) {
      const intrinsicWidth = Math.max(0, measurement.width);
      node.box.scrollWidth = Math.max(node.box.scrollWidth, intrinsicWidth);

      if (node.style.display === Display.InlineBlock && node.style.width === "auto") {
        const minWidth =
          node.style.minWidth !== undefined ? resolveLength(node.style.minWidth, cb.width, { auto: "zero", ...containerRefs }) : undefined;
        const maxWidth =
          node.style.maxWidth !== undefined
            ? resolveLength(node.style.maxWidth, cb.width, { auto: "reference", ...containerRefs })
            : undefined;

        let targetContentWidth = intrinsicWidth;
        targetContentWidth = Math.min(targetContentWidth, availableWidth);
        if (minWidth !== undefined) {
          targetContentWidth = Math.max(targetContentWidth, minWidth);
        }
        if (maxWidth !== undefined) {
          targetContentWidth = Math.min(targetContentWidth, maxWidth);
        }
        targetContentWidth = Math.max(0, targetContentWidth);

        if (node.style.display === Display.InlineBlock) {
          layoutDebug(
            `[BlockLayout] intrinsic measurement tag=${debugTag} intrinsic=${intrinsicWidth} current=${node.box.contentWidth} horizontalExtras=${horizontalExtras} available=${availableWidth}`,
          );
        }
        if (measurement.leftOffset > 0) {
          layoutDebug(
            `[BlockLayout] shifting inline-block children tag=${debugTag} offset=${measurement.leftOffset}`,
          );
          contentMeasurer.shiftInFlowChildrenX(node, measurement.leftOffset);
        }
        if (targetContentWidth !== node.box.contentWidth) {
          node.box.contentWidth = targetContentWidth;
          contentWidth = targetContentWidth;
          node.box.borderBoxWidth = node.box.contentWidth + horizontalExtras;
          node.box.marginBoxWidth = node.box.borderBoxWidth + horizontalMarginSize;
          if (node.style.display === Display.InlineBlock) {
            layoutDebug(
              `[BlockLayout] updated inline-block tag=${debugTag} newContentWidth=${node.box.contentWidth} borderBoxWidth=${node.box.borderBoxWidth}`,
            );
          }
        }
      }
    }

    const floatBottom = Math.max(floatContext.bottom("left"), floatContext.bottom("right"));
    const effectiveCursor = Math.max(cursorY, floatBottom);
    node.box.contentHeight = Math.max(0, effectiveCursor - (node.box.y + borderTop) - paddingTop);
    if (node.style.height !== "auto") {
      const vertExtras = verticalNonContent(node, cb.height, cb.width);
      node.box.contentHeight = adjustForBoxSizing(
        resolveLength(node.style.height, cb.height, { auto: "zero", ...containerRefs }),
        node.style.boxSizing,
        vertExtras,
      );
    }
    const verticalExtras = verticalNonContent(node, cb.height, cb.width);
    node.box.borderBoxHeight = node.box.contentHeight + verticalExtras;
    node.box.marginBoxHeight =
      node.box.borderBoxHeight +
      resolveLength(node.style.marginTop, cb.height, { auto: "zero", ...containerRefs }) +
      resolveLength(node.style.marginBottom, cb.height, { auto: "zero", ...containerRefs });

    finalizeOverflow(node);
  }
}
