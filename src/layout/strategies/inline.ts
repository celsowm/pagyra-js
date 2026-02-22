import { LayoutNode } from "../../dom/node.js";
import { Display, FloatMode } from "../../css/enums.js";
import { resolveLength } from "../../css/length.js";
import { resolvedLineHeight } from "../../css/style.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import { FloatContext } from "../context/float-context.js";
import { defaultInlineFormatter } from "../utils/inline-formatter.js";
import { containingBlock } from "../utils/node-math.js";

export class InlineLayoutStrategy implements LayoutStrategy {
  canLayout(node: LayoutNode): boolean {
    return node.style.display === Display.Inline;
  }

  layout(node: LayoutNode, context: LayoutContext): void {
    const cb = containingBlock(node, context.env.viewport);
    const refWidth = Math.max(cb.width || context.env.viewport.width, 0);
    const refHeight = Math.max(cb.height || context.env.viewport.height, 0);
    const containerRefs = { containerWidth: refWidth, containerHeight: refHeight };
    const paddingLeft = resolveLength(node.style.paddingLeft, refWidth, { auto: "zero", ...containerRefs });
    const paddingRight = resolveLength(node.style.paddingRight, refWidth, { auto: "zero", ...containerRefs });
    const paddingTop = resolveLength(node.style.paddingTop, refHeight, { auto: "zero", ...containerRefs });
    const paddingBottom = resolveLength(node.style.paddingBottom, refHeight, { auto: "zero", ...containerRefs });
    const borderLeft = resolveLength(node.style.borderLeft, refWidth, { auto: "zero", ...containerRefs });
    const borderRight = resolveLength(node.style.borderRight, refWidth, { auto: "zero", ...containerRefs });
    const borderTop = resolveLength(node.style.borderTop, refHeight, { auto: "zero", ...containerRefs });
    const borderBottom = resolveLength(node.style.borderBottom, refHeight, { auto: "zero", ...containerRefs });

    const marginLeft = resolveLength(node.style.marginLeft, refWidth, { auto: "zero", ...containerRefs });
    const marginRight = resolveLength(node.style.marginRight, refWidth, { auto: "zero", ...containerRefs });
    const marginTop = resolveLength(node.style.marginTop, refHeight, { auto: "zero", ...containerRefs });
    const marginBottom = resolveLength(node.style.marginBottom, refHeight, { auto: "zero", ...containerRefs });

    const horizontalExtras = paddingLeft + paddingRight + borderLeft + borderRight;
    const verticalExtras = paddingTop + paddingBottom + borderTop + borderBottom;

    const inlineNodes = collectInlineParticipants(node);
    const floatContext = new FloatContext();
    const startY = node.box.y;
    const availableWidth = Math.max(refWidth, 0);

    const result = defaultInlineFormatter.layout({
      container: node,
      inlineNodes,
      context,
      floatContext,
      contentX: node.box.x + borderLeft + paddingLeft,
      contentWidth: availableWidth,
      startY,
    });

    const extent = measureInlineExtent(inlineNodes, refWidth, refHeight, node.box.x + borderLeft + paddingLeft);
    const floatBottom = Math.max(floatContext.bottom("left"), floatContext.bottom("right"));
    const measuredHeight = Math.max(result.newCursorY, floatBottom) - startY;

    node.box.contentWidth = Math.max(0, extent);
    node.box.contentHeight = Math.max(0, measuredHeight);
    node.box.borderBoxWidth = node.box.contentWidth + horizontalExtras;
    node.box.borderBoxHeight = node.box.contentHeight + verticalExtras;
    node.box.marginBoxWidth = node.box.borderBoxWidth + marginLeft + marginRight;
    node.box.marginBoxHeight = node.box.borderBoxHeight + marginTop + marginBottom;
    node.box.scrollWidth = Math.max(node.box.scrollWidth, node.box.contentWidth);
    node.box.scrollHeight = Math.max(node.box.scrollHeight, node.box.contentHeight);
    if (node.box.baseline === undefined) {
      node.box.baseline = node.box.y + node.box.contentHeight || node.box.y + resolvedLineHeight(node.style);
    }
  }
}

function collectInlineParticipants(node: LayoutNode): LayoutNode[] {
  const participants: LayoutNode[] = [];
  for (const child of node.children) {
    if (child.style.display === Display.None) {
      continue;
    }
    if (child.style.float !== FloatMode.None) {
      continue;
    }
    if (!isInlineDisplay(child.style.display)) {
      continue;
    }
    participants.push(child);
  }
  return participants;
}

function isInlineDisplay(display: Display): boolean {
  switch (display) {
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

function measureInlineExtent(
  inlineNodes: LayoutNode[],
  referenceWidth: number,
  containerHeight: number,
  contentStartX: number,
): number {
  if (inlineNodes.length === 0) {
    return 0;
  }
  const containerRefs = { containerWidth: referenceWidth, containerHeight };
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  for (const node of inlineNodes) {
    const marginLeft = resolveLength(node.style.marginLeft, referenceWidth, { auto: "zero", ...containerRefs });
    const marginRight = resolveLength(node.style.marginRight, referenceWidth, { auto: "zero", ...containerRefs });
    const paddingLeft = resolveLength(node.style.paddingLeft, referenceWidth, { auto: "zero", ...containerRefs });
    const paddingRight = resolveLength(node.style.paddingRight, referenceWidth, { auto: "zero", ...containerRefs });
    const borderLeft = resolveLength(node.style.borderLeft, referenceWidth, { auto: "zero", ...containerRefs });
    const borderRight = resolveLength(node.style.borderRight, referenceWidth, { auto: "zero", ...containerRefs });

    const marginStart = node.box.x - paddingLeft - borderLeft - marginLeft;
    const width =
      node.box.contentWidth +
      paddingLeft +
      paddingRight +
      borderLeft +
      borderRight +
      marginLeft +
      marginRight;
    const relativeStart = marginStart - contentStartX;
    const relativeEnd = relativeStart + width;
    minStart = Math.min(minStart, relativeStart);
    maxEnd = Math.max(maxEnd, relativeEnd);
  }
  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
    return 0;
  }
  return Math.max(0, maxEnd - minStart);
}
