import { LayoutNode } from "../../dom/node.js";
import { Display, FloatMode, OverflowMode, Position } from "../../css/enums.js";
import { clampMinMax, resolveLength } from "../../css/length.js";
import type { ContainingBlock, Viewport } from "../../geometry/box.js";

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
  const available = Math.max(0, containingBlockWidth - horizontalNonContent(node, containingBlockWidth) - horizontalMargin(node, containingBlockWidth));
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
