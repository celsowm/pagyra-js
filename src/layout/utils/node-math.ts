import { LayoutNode } from "../../dom/node.js";
import { Display, FloatMode, OverflowMode, Position } from "../../css/enums.js";
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
  const paddingLeft = resolveLength(style.paddingLeft, widthRef, { auto: "zero" });
  const paddingRight = resolveLength(style.paddingRight, widthRef, { auto: "zero" });
  const paddingTop = resolveLength(style.paddingTop, heightRef, { auto: "zero" });
  const paddingBottom = resolveLength(style.paddingBottom, heightRef, { auto: "zero" });
  const borderLeft = resolveLength(style.borderLeft, widthRef, { auto: "zero" });
  const borderRight = resolveLength(style.borderRight, widthRef, { auto: "zero" });
  const borderTop = resolveLength(style.borderTop, heightRef, { auto: "zero" });
  const borderBottom = resolveLength(style.borderBottom, heightRef, { auto: "zero" });

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

export function horizontalNonContent(node: LayoutNode, reference: number): number {
  const { style } = node;
  return (
    resolveLength(style.paddingLeft, reference, { auto: "zero" }) +
    resolveLength(style.paddingRight, reference, { auto: "zero" }) +
    resolveLength(style.borderLeft, reference, { auto: "zero" }) +
    resolveLength(style.borderRight, reference, { auto: "zero" })
  );
}

export function verticalNonContent(node: LayoutNode, reference: number): number {
  const { style } = node;
  return (
    resolveLength(style.paddingTop, reference, { auto: "zero" }) +
    resolveLength(style.paddingBottom, reference, { auto: "zero" }) +
    resolveLength(style.borderTop, reference, { auto: "zero" }) +
    resolveLength(style.borderBottom, reference, { auto: "zero" })
  );
}

export function horizontalMargin(node: LayoutNode, reference: number): number {
  const { style } = node;
  return resolveLength(style.marginLeft, reference, { auto: "zero" }) + resolveLength(style.marginRight, reference, { auto: "zero" });
}

export function verticalMargin(node: LayoutNode, reference: number): number {
  const { style } = node;
  return resolveLength(style.marginTop, reference, { auto: "zero" }) + resolveLength(style.marginBottom, reference, { auto: "zero" });
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
    const explicitHeight = resolveLength(parent.style.height, viewport.height, { auto: "reference" });
    if (Number.isFinite(explicitHeight) && explicitHeight > 0) {
      heightRef = explicitHeight;
    }
  }
  const xOffset =
    parent.box.x +
    resolveLength(parent.style.paddingLeft, widthRef, { auto: "zero" }) +
    resolveLength(parent.style.borderLeft, widthRef, { auto: "zero" });
  const yOffset =
    parent.box.y +
    resolveLength(parent.style.paddingTop, heightRef, { auto: "zero" }) +
    resolveLength(parent.style.borderTop, heightRef, { auto: "zero" });

  return {
    x: xOffset,
    y: yOffset,
    width: parent.box.contentWidth,
    height: heightRef,
  };
}

export function resolveWidthBlock(node: LayoutNode, containingBlockWidth: number): number {
  const style = node.style;
  const marginLeft = isAutoLength(style.marginLeft)
    ? 0
    : resolveLength(style.marginLeft, containingBlockWidth, { auto: "zero" });
  const marginRight = isAutoLength(style.marginRight)
    ? 0
    : resolveLength(style.marginRight, containingBlockWidth, { auto: "zero" });
  const available = Math.max(
    0,
    containingBlockWidth - horizontalNonContent(node, containingBlockWidth) - marginLeft - marginRight,
  );
  const width =
    style.width === "auto"
      ? available
      : resolveLength(style.width, containingBlockWidth, {
        auto: "reference",
      });
  const minWidth = style.minWidth ? resolveLength(style.minWidth, containingBlockWidth, { auto: "zero" }) : Number.NEGATIVE_INFINITY;
  const maxWidth = style.maxWidth ? resolveLength(style.maxWidth, containingBlockWidth, { auto: "reference" }) : Number.POSITIVE_INFINITY;
  return clampMinMax(width, minWidth, maxWidth);
}

export function resolveBlockAutoMargins(
  containingBlockWidth: number,
  borderBoxWidth: number,
  marginLeft: LengthLike,
  marginRight: LengthLike,
): { marginLeft: number; marginRight: number } {
  const marginLeftAuto = isAutoLength(marginLeft);
  const marginRightAuto = isAutoLength(marginRight);

  const resolvedMarginLeft = marginLeftAuto ? 0 : resolveLength(marginLeft, containingBlockWidth, { auto: "zero" });
  const resolvedMarginRight = marginRightAuto ? 0 : resolveLength(marginRight, containingBlockWidth, { auto: "zero" });

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
