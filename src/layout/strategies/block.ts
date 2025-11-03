import { LayoutNode } from "../../dom/node.js";
import { Display, FloatMode } from "../../css/enums.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import {
  containingBlock,
  establishesBFC,
  horizontalNonContent,
  horizontalMargin,
  inFlow,
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
import { layoutInlineFormattingContext } from "../utils/inline-formatting.js";

const LAYOUT_DEBUG = process.env.PAGYRA_DEBUG_LAYOUT === "1";
const layoutDebug = (...args: unknown[]): void => {
  if (LAYOUT_DEBUG) {
    console.log(...args);
  }
};

export class BlockLayoutStrategy implements LayoutStrategy {
  private readonly supportedDisplays = new Set<Display>([Display.Block, Display.FlowRoot, Display.InlineBlock, Display.TableCell]);

  canLayout(node: LayoutNode): boolean {
    return this.supportedDisplays.has(node.style.display);
  }

  layout(node: LayoutNode, context: LayoutContext): void {
    const cb = containingBlock(node, context.env.viewport);
    node.establishesBFC = establishesBFC(node);

    let contentWidth = resolveWidthBlock(node, cb.width);
    const debugTag = node.tagName ?? "(anonymous)";
    if (node.style.display === Display.InlineBlock) {
      layoutDebug(
        `[BlockLayout] start inline-block tag=${debugTag} style.width=${node.style.width} resolvedContentWidth=${contentWidth} cb.width=${cb.width}`,
      );
    }
    const availableWidth = contentWidth;
    node.box.contentWidth = contentWidth;

    const horizontalExtras = horizontalNonContent(node, contentWidth);
    const horizontalMarginSize = horizontalMargin(node, contentWidth);
    node.box.borderBoxWidth = contentWidth + horizontalExtras;
    node.box.marginBoxWidth = node.box.borderBoxWidth + horizontalMarginSize;

    const paddingLeft = resolveLength(node.style.paddingLeft, contentWidth, { auto: "zero" });
    const borderLeft = resolveLength(node.style.borderLeft, contentWidth, { auto: "zero" });
    const paddingTop = resolveLength(node.style.paddingTop, contentWidth, { auto: "zero" });
    const borderTop = resolveLength(node.style.borderTop, contentWidth, { auto: "zero" });

    const contentX = node.box.x + borderLeft + paddingLeft;
    const collapseTopWithChildren = canCollapseMarginStart(node, contentWidth);
    const collapseBottomWithChildren = canCollapseMarginEnd(node, contentWidth);
    const firstCollapsibleChild = collapseTopWithChildren ? findFirstMarginCollapsibleChild(node) : undefined;
    const lastCollapsibleChild = collapseBottomWithChildren ? findLastMarginCollapsibleChild(node) : undefined;
    const topCollapseAmount =
      collapseTopWithChildren && firstCollapsibleChild ? effectiveMarginTop(firstCollapsibleChild, contentWidth) : 0;
    const bottomCollapseAmount =
      collapseBottomWithChildren && lastCollapsibleChild ? effectiveMarginBottom(lastCollapsibleChild, contentWidth) : 0;

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

        const result = layoutInlineFormattingContext({
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

      const childMarginTopRaw = resolveLength(child.style.marginTop, contentWidth, { auto: "zero" });
      const childMarginLeft = resolveLength(child.style.marginLeft, contentWidth, { auto: "zero" });
      const childMarginBottomRaw = resolveLength(child.style.marginBottom, contentWidth, { auto: "zero" });
      const collapsedMarginTop = effectiveMarginTop(child, contentWidth);
      const collapsedMarginBottom = effectiveMarginBottom(child, contentWidth);

      let gap = collapsedGapBetween(previousBottomMargin, collapsedMarginTop, node.establishesBFC);
      if (collapseTopWithChildren && child === firstCollapsibleChild) {
        gap -= topCollapseAmount;
      }
      cursorY += gap;

      const originX = contentX + childMarginLeft;
      child.box.x = originX;
      child.box.y = cursorY;

      // Lay out the child. The child's strategy is responsible for setting its own
      // box model properties, including contentHeight and borderBoxHeight.
      context.layoutChild(child);

      // **FIX:** The line below was removed. It was incorrectly overwriting the
      // borderBoxHeight calculated by complex child strategies (like TableLayoutStrategy).
      // REMOVED: child.box.borderBoxHeight = child.box.contentHeight + verticalNonContent(child, contentWidth);

      // Now, use the authoritative borderBoxHeight set by the child's layout strategy
      // to advance the cursor.
      child.box.marginBoxHeight = child.box.borderBoxHeight + childMarginTopRaw + childMarginBottomRaw;
      previousBottomMargin = collapsedMarginBottom;
      let nextCursor = child.box.y + child.box.borderBoxHeight + childMarginBottomRaw;
      if (collapseBottomWithChildren && child === lastCollapsibleChild) {
        nextCursor -= bottomCollapseAmount;
        previousBottomMargin = 0;
      }
      cursorY = nextCursor;
    }

    const measurement = measureInFlowContentWidth(node, contentWidth, contentX);
    if (Number.isFinite(measurement.width)) {
      const intrinsicWidth = Math.max(0, measurement.width);
      node.box.scrollWidth = Math.max(node.box.scrollWidth, intrinsicWidth);

      if (node.style.display === Display.InlineBlock && node.style.width === "auto") {
        const minWidth =
          node.style.minWidth !== undefined ? resolveLength(node.style.minWidth, cb.width, { auto: "zero" }) : undefined;
        const maxWidth =
          node.style.maxWidth !== undefined
            ? resolveLength(node.style.maxWidth, cb.width, { auto: "reference" })
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
          shiftInFlowChildrenX(node, measurement.leftOffset);
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
      node.box.contentHeight = resolveLength(node.style.height, cb.height, { auto: "zero" });
    }
    const verticalExtras = verticalNonContent(node, contentWidth);
    node.box.borderBoxHeight = node.box.contentHeight + verticalExtras;
    node.box.marginBoxHeight =
      node.box.borderBoxHeight +
      resolveLength(node.style.marginTop, contentWidth, { auto: "zero" }) +
      resolveLength(node.style.marginBottom, contentWidth, { auto: "zero" });

    finalizeOverflow(node);
  }
}

function isInlineLevel(node: LayoutNode): boolean {
  switch (node.style.display) {
    case Display.Inline:
    case Display.InlineBlock:
    case Display.InlineFlex:
    case Display.InlineGrid:
    case Display.InlineTable:
      return true;
    default:
      return false;
  }
}

function measureInFlowContentWidth(
  node: LayoutNode,
  referenceWidth: number,
  contentStartX: number,
): { width: number; leftOffset: number } {
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  let hasContent = false;

  for (const child of node.children) {
    if (!inFlow(child)) {
      continue;
    }
    if (child.style.display === Display.None) {
      continue;
    }

    const marginLeft = resolveLength(child.style.marginLeft, referenceWidth, { auto: "zero" });
    const marginRight = resolveLength(child.style.marginRight, referenceWidth, { auto: "zero" });
    const borderLeft = resolveLength(child.style.borderLeft, referenceWidth, { auto: "zero" });
    const borderRight = resolveLength(child.style.borderRight, referenceWidth, { auto: "zero" });
    const paddingLeft = resolveLength(child.style.paddingLeft, referenceWidth, { auto: "zero" });
    const paddingRight = resolveLength(child.style.paddingRight, referenceWidth, { auto: "zero" });

    const borderBoxWidth = child.box.borderBoxWidth || Math.max(0, child.box.contentWidth + paddingLeft + paddingRight + borderLeft + borderRight);
    const marginBoxWidth = borderBoxWidth + marginLeft + marginRight;
    const marginStart = child.box.x - paddingLeft - borderLeft - marginLeft;
    const relativeStart = marginStart - contentStartX;
    const relativeEnd = relativeStart + marginBoxWidth;
    layoutDebug(
      `[measureInFlowContentWidth] parent=${node.tagName ?? "(anonymous)"} child=${child.tagName ?? "(anonymous)"} marginStart=${marginStart} relativeStart=${relativeStart} marginBoxWidth=${marginBoxWidth} borderBoxWidth=${borderBoxWidth} child.box.x=${child.box.x} contentStartX=${contentStartX}`,
    );

    minStart = Math.min(minStart, relativeStart);
    maxEnd = Math.max(maxEnd, relativeEnd);
    hasContent = true;
  }

  if (!hasContent) {
    return { width: 0, leftOffset: 0 };
  }

  if (!Number.isFinite(minStart)) {
    minStart = 0;
  }
  if (!Number.isFinite(maxEnd)) {
    maxEnd = minStart;
  }

  const width = Math.max(0, maxEnd - minStart);
  const leftOffset = minStart > 0 ? minStart : 0;
  return { width, leftOffset };
}

function shiftInFlowChildrenX(node: LayoutNode, deltaX: number): void {
  if (deltaX === 0) {
    return;
  }
  for (const child of node.children) {
    if (!inFlow(child)) {
      continue;
    }
    if (child.style.display === Display.None) {
      continue;
    }
    child.walk((desc) => {
      if (desc === node) {
        return;
      }
      desc.box.x -= deltaX;
    });
  }
}
