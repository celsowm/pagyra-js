import { LayoutNode } from "../../dom/node.js";
import { ClearMode, FloatMode } from "../../css/enums.js";
import { resolveLength } from "../../css/length.js";
import { FloatContext } from "../context/float-context.js";
import type { LayoutContext } from "../pipeline/strategy.js";

interface FloatPlacementOptions {
  node: LayoutNode;
  floatContext: FloatContext;
  context: LayoutContext;
  contentX: number;
  contentWidth: number;
  contentHeight?: number;
  startY: number;
}

export function clearForBlock(node: LayoutNode, floatContext: FloatContext, yCursor: number): number {
  const { clear } = node.style;
  let y = yCursor;
  if (clear === ClearMode.Left || clear === ClearMode.Both || clear === ClearMode.InlineStart) {
    y = Math.max(y, floatContext.bottom("left"));
  }
  if (clear === ClearMode.Right || clear === ClearMode.Both || clear === ClearMode.InlineEnd) {
    y = Math.max(y, floatContext.bottom("right"));
  }
  return y;
}

export function placeFloat(options: FloatPlacementOptions): number {
  const { node, floatContext, context, contentX, contentWidth } = options;
  const contentHeight = options.contentHeight ?? contentWidth;
  const containerRefs = { containerWidth: contentWidth, containerHeight: contentHeight };

  context.layoutChild(node);

  const marginLeft = resolveLength(node.style.marginLeft, contentWidth, { auto: "zero", ...containerRefs });
  const marginRight = resolveLength(node.style.marginRight, contentWidth, { auto: "zero", ...containerRefs });
  const marginTop = resolveLength(node.style.marginTop, contentHeight, { auto: "zero", ...containerRefs });
  const marginBottom = resolveLength(node.style.marginBottom, contentHeight, { auto: "zero", ...containerRefs });

  const borderLeft = resolveLength(node.style.borderLeft, contentWidth, { auto: "zero", ...containerRefs });
  const borderRight = resolveLength(node.style.borderRight, contentWidth, { auto: "zero", ...containerRefs });
  const borderTop = resolveLength(node.style.borderTop, contentHeight, { auto: "zero", ...containerRefs });
  const borderBottom = resolveLength(node.style.borderBottom, contentHeight, { auto: "zero", ...containerRefs });

  const paddingLeft = resolveLength(node.style.paddingLeft, contentWidth, { auto: "zero", ...containerRefs });
  const paddingRight = resolveLength(node.style.paddingRight, contentWidth, { auto: "zero", ...containerRefs });
  const paddingTop = resolveLength(node.style.paddingTop, contentHeight, { auto: "zero", ...containerRefs });
  const paddingBottom = resolveLength(node.style.paddingBottom, contentHeight, { auto: "zero", ...containerRefs });

  const borderBoxWidth = node.box.contentWidth + paddingLeft + paddingRight + borderLeft + borderRight;
  const borderBoxHeight = node.box.contentHeight + paddingTop + paddingBottom + borderTop + borderBottom;

  node.box.borderBoxWidth = borderBoxWidth;
  node.box.borderBoxHeight = borderBoxHeight;
  node.box.marginBoxWidth = borderBoxWidth + marginLeft + marginRight;
  node.box.marginBoxHeight = borderBoxHeight + marginTop + marginBottom;

  const outerWidth = node.box.marginBoxWidth;
  const outerHeight = node.box.marginBoxHeight;

  let y = options.startY;
  let attempts = 0;
  while (true) {
    if (attempts > 1000) {
      break;
    }
    const offsets = floatContext.inlineOffsets(y, y + outerHeight, contentWidth);
    const availableWidth = Math.max(0, offsets.end - offsets.start);
    if (outerWidth <= availableWidth) {
      const marginBoxStart =
        node.style.float === FloatMode.Left
          ? contentX + offsets.start
          : contentX + offsets.end - outerWidth;

      const contentXPosition = marginBoxStart + marginLeft + borderLeft + paddingLeft;
      const contentYPosition = y + marginTop + borderTop + paddingTop;

      node.box.x = contentXPosition;
      node.box.y = contentYPosition;
      node.box.scrollWidth = node.box.contentWidth;
      node.box.scrollHeight = node.box.contentHeight;

      floatContext.register(node.style.float === FloatMode.Left ? "left" : "right", {
        top: y,
        bottom: y + outerHeight,
        inlineStart: marginBoxStart - contentX,
        inlineEnd: marginBoxStart - contentX + outerWidth,
      });
      return y + outerHeight;
    }
    const nextY = floatContext.nextUnblockedY(y, y + outerHeight);
    if (nextY === null || nextY <= y) {
      y += 1;
    } else {
      y = nextY;
    }
    attempts += 1;
  }
  return y + outerHeight;
}
