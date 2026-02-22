import { LayoutNode } from "../../dom/node.js";
import { BoxSizing, Display, FloatMode, OverflowMode, Position } from "../../css/enums.js";
import { clampMinMax, resolveLength, isAutoLength, type LengthLike } from "../../css/length.js";
import type { ContainingBlock, Viewport } from "../../geometry/box.js";

export interface BoxMetrics {
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  borderLeft: number;
  borderRight: number;
  borderTop: number;
  borderBottom: number;
  contentBoxX: number;
  contentBoxY: number;
}

export function resolveBoxMetrics(node: LayoutNode, widthRef: number, heightRef: number): BoxMetrics {
  const { style } = node;
  const containerRefs = { containerWidth: widthRef, containerHeight: heightRef };
  const paddingLeft = resolveLength(style.paddingLeft, widthRef, { auto: "zero", ...containerRefs });
  const paddingRight = resolveLength(style.paddingRight, widthRef, { auto: "zero", ...containerRefs });
  const paddingTop = resolveLength(style.paddingTop, heightRef, { auto: "zero", ...containerRefs });
  const paddingBottom = resolveLength(style.paddingBottom, heightRef, { auto: "zero", ...containerRefs });
  const borderLeft = resolveLength(style.borderLeft, widthRef, { auto: "zero", ...containerRefs });
  const borderRight = resolveLength(style.borderRight, widthRef, { auto: "zero", ...containerRefs });
  const borderTop = resolveLength(style.borderTop, heightRef, { auto: "zero", ...containerRefs });
  const borderBottom = resolveLength(style.borderBottom, heightRef, { auto: "zero", ...containerRefs });

  return {
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    borderLeft,
    borderRight,
    borderTop,
    borderBottom,
    contentBoxX: node.box.x + borderLeft + paddingLeft,
    contentBoxY: node.box.y + borderTop + paddingTop,
  };
}

export function adjustForBoxSizing(specifiedSize: number, boxSizing: BoxSizing, nonContentExtras: number): number {
  if (boxSizing === BoxSizing.BorderBox) {
    return Math.max(0, specifiedSize - nonContentExtras);
  }
  return specifiedSize;
}

export function horizontalNonContent(node: LayoutNode, reference: number, containerHeight: number = reference): number {
  const { style } = node;
  const containerRefs = { containerWidth: reference, containerHeight };
  return (
    resolveLength(style.paddingLeft, reference, { auto: "zero", ...containerRefs }) +
    resolveLength(style.paddingRight, reference, { auto: "zero", ...containerRefs }) +
    resolveLength(style.borderLeft, reference, { auto: "zero", ...containerRefs }) +
    resolveLength(style.borderRight, reference, { auto: "zero", ...containerRefs })
  );
}

export function verticalNonContent(node: LayoutNode, reference: number, containerWidth: number = reference): number {
  const { style } = node;
  const containerRefs = { containerWidth, containerHeight: reference };
  return (
    resolveLength(style.paddingTop, reference, { auto: "zero", ...containerRefs }) +
    resolveLength(style.paddingBottom, reference, { auto: "zero", ...containerRefs }) +
    resolveLength(style.borderTop, reference, { auto: "zero", ...containerRefs }) +
    resolveLength(style.borderBottom, reference, { auto: "zero", ...containerRefs })
  );
}

export function horizontalMargin(node: LayoutNode, reference: number, containerHeight: number = reference): number {
  const { style } = node;
  const containerRefs = { containerWidth: reference, containerHeight };
  return (
    resolveLength(style.marginLeft, reference, { auto: "zero", ...containerRefs }) +
    resolveLength(style.marginRight, reference, { auto: "zero", ...containerRefs })
  );
}

export function verticalMargin(node: LayoutNode, reference: number, containerWidth: number = reference): number {
  const { style } = node;
  const containerRefs = { containerWidth, containerHeight: reference };
  return (
    resolveLength(style.marginTop, reference, { auto: "zero", ...containerRefs }) +
    resolveLength(style.marginBottom, reference, { auto: "zero", ...containerRefs })
  );
}

export function inFlow(node: LayoutNode): boolean {
  const { position, float: floatMode } = node.style;
  const isFlowPosition = position === Position.Static || position === Position.Relative || position === Position.Sticky;
  return isFlowPosition && floatMode === FloatMode.None;
}

export function establishesBFC(node: LayoutNode): boolean {
  const { style } = node;
  return (
    style.float !== FloatMode.None ||
    style.position === Position.Absolute ||
    style.position === Position.Fixed ||
    overflowCreatesBFC(style.overflowX) ||
    overflowCreatesBFC(style.overflowY) ||
    style.display === Display.InlineBlock ||
    style.display === Display.Table ||
    style.display === Display.InlineTable ||
    style.display === Display.FlowRoot
  );
}

function overflowCreatesBFC(mode: OverflowMode): boolean {
  switch (mode) {
    case OverflowMode.Hidden:
    case OverflowMode.Auto:
    case OverflowMode.Scroll:
    case OverflowMode.Clip:
      return true;
    default:
      return false;
  }
}

export function nearestPositionedAncestor(node: LayoutNode): LayoutNode | null {
  return node.nearestAncestor((ancestor) => {
    const position = ancestor.style.position;
    return position === Position.Relative || position === Position.Absolute || position === Position.Fixed || position === Position.Sticky;
  });
}

export function containingBlock(node: LayoutNode, viewport: Viewport): ContainingBlock {
  const { style } = node;
  if (style.position === Position.Fixed) {
    return { x: 0, y: 0, width: viewport.width, height: viewport.height };
  }
  if (style.position === Position.Absolute) {
    const ancestor = nearestPositionedAncestor(node);
    if (ancestor) {
      return {
        x: ancestor.box.x,
        y: ancestor.box.y,
        width: ancestor.box.contentWidth,
        height: ancestor.box.contentHeight,
      };
    }
    return { x: 0, y: 0, width: viewport.width, height: viewport.height };
  }

  const parent = node.parent;
  if (!parent) {
    return { x: 0, y: 0, width: viewport.width, height: viewport.height };
  }

  const widthRef = Math.max(parent.box.contentWidth, 0);
  let heightRef = Math.max(parent.box.contentHeight, 0);

  // If the parent has an explicit height but its content height has not
  // been resolved yet (common when laying out flex/grid children before
  // the block container finalizes), fall back to the specified height.
  // This allows percentage heights like `height: 100%` on flex children
  // to resolve against a definite containing block height instead of 0.
  if (heightRef === 0 && parent.style.height !== "auto") {
    const explicitHeight = resolveLength(parent.style.height, viewport.height, {
      auto: "reference",
      containerWidth: viewport.width,
      containerHeight: viewport.height,
    });
    if (Number.isFinite(explicitHeight) && explicitHeight > 0) {
      heightRef = explicitHeight;
    }
  }
  const containerRefs = { containerWidth: widthRef, containerHeight: heightRef };
  const xOffset =
    parent.box.x +
    resolveLength(parent.style.paddingLeft, widthRef, { auto: "zero", ...containerRefs }) +
    resolveLength(parent.style.borderLeft, widthRef, { auto: "zero", ...containerRefs });
  const yOffset =
    parent.box.y +
    resolveLength(parent.style.paddingTop, heightRef, { auto: "zero", ...containerRefs }) +
    resolveLength(parent.style.borderTop, heightRef, { auto: "zero", ...containerRefs });

  return {
    x: xOffset,
    y: yOffset,
    width: parent.box.contentWidth,
    height: heightRef,
  };
}

export function resolveWidthBlock(
  node: LayoutNode,
  containingBlockWidth: number,
  containingBlockHeight: number = containingBlockWidth,
): number {
  const style = node.style;
  const containerRefs = { containerWidth: containingBlockWidth, containerHeight: containingBlockHeight };
  const hNonContent = horizontalNonContent(node, containingBlockWidth, containingBlockHeight);
  const marginLeft = isAutoLength(style.marginLeft)
    ? 0
    : resolveLength(style.marginLeft, containingBlockWidth, { auto: "zero", ...containerRefs });
  const marginRight = isAutoLength(style.marginRight)
    ? 0
    : resolveLength(style.marginRight, containingBlockWidth, { auto: "zero", ...containerRefs });
  const available = Math.max(
    0,
    containingBlockWidth - hNonContent - marginLeft - marginRight,
  );
  const width =
    style.width === "auto"
      ? available
      : adjustForBoxSizing(
          resolveLength(style.width, containingBlockWidth, { auto: "reference", ...containerRefs }),
          style.boxSizing,
          hNonContent,
        );
  const minWidth = style.minWidth
    ? adjustForBoxSizing(
        resolveLength(style.minWidth, containingBlockWidth, { auto: "zero", ...containerRefs }),
        style.boxSizing,
        hNonContent,
      )
    : Number.NEGATIVE_INFINITY;
  const maxWidth = style.maxWidth
    ? adjustForBoxSizing(
        resolveLength(style.maxWidth, containingBlockWidth, { auto: "reference", ...containerRefs }),
        style.boxSizing,
        hNonContent,
      )
    : Number.POSITIVE_INFINITY;
  return clampMinMax(width, minWidth, maxWidth);
}

export function resolveBlockAutoMargins(
  containingBlockWidth: number,
  borderBoxWidth: number,
  marginLeft: LengthLike,
  marginRight: LengthLike,
  containingBlockHeight: number = containingBlockWidth,
): { marginLeft: number; marginRight: number } {
  const containerRefs = { containerWidth: containingBlockWidth, containerHeight: containingBlockHeight };
  const marginLeftAuto = isAutoLength(marginLeft);
  const marginRightAuto = isAutoLength(marginRight);

  const resolvedMarginLeft = marginLeftAuto ? 0 : resolveLength(marginLeft, containingBlockWidth, { auto: "zero", ...containerRefs });
  const resolvedMarginRight = marginRightAuto ? 0 : resolveLength(marginRight, containingBlockWidth, { auto: "zero", ...containerRefs });

  let usedMarginLeft = resolvedMarginLeft;
  let usedMarginRight = resolvedMarginRight;

  const remainingSpace = containingBlockWidth - (borderBoxWidth + resolvedMarginLeft + resolvedMarginRight);

  if (!Number.isFinite(remainingSpace)) {
    return { marginLeft: usedMarginLeft, marginRight: usedMarginRight };
  }

  if (remainingSpace < 0) {
    if (marginLeftAuto && marginRightAuto) {
      usedMarginLeft = 0;
      usedMarginRight = 0;
    } else if (marginLeftAuto) {
      usedMarginLeft = 0;
    } else if (marginRightAuto) {
      usedMarginRight = 0;
    } else {
      usedMarginRight = resolvedMarginRight + remainingSpace;
    }
  } else {
    if (marginLeftAuto && marginRightAuto) {
      usedMarginLeft = remainingSpace / 2;
      usedMarginRight = remainingSpace / 2;
    } else if (marginLeftAuto) {
      usedMarginLeft = remainingSpace;
    } else if (marginRightAuto) {
      usedMarginRight = remainingSpace;
    } else {
      usedMarginRight = resolvedMarginRight + remainingSpace;
    }
  }

  return { marginLeft: usedMarginLeft, marginRight: usedMarginRight };
}
