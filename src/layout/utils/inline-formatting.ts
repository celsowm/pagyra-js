import { LayoutNode } from "../../dom/node.js";
import { Display } from "../../css/enums.js";
import { resolvedLineHeight } from "../../css/style.js";
import { resolveLength } from "../../css/length.js";
import { FloatContext } from "../context/float-context.js";
import type { LayoutContext } from "../pipeline/strategy.js";

interface InlineLayoutOptions {
  container: LayoutNode;
  inlineNodes: LayoutNode[];
  context: LayoutContext;
  floatContext: FloatContext;
  contentX: number;
  contentWidth: number;
  startY: number;
}

interface InlineMetrics {
  node: LayoutNode;
  contentWidth: number;
  contentHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  borderLeft: number;
  borderRight: number;
  borderTop: number;
  borderBottom: number;
  outerWidth: number;
  outerHeight: number;
}

interface InlineLayoutResult {
  newCursorY: number;
}

export function layoutInlineFormattingContext(options: InlineLayoutOptions): InlineLayoutResult {
  const { container, inlineNodes, context, floatContext, contentX, contentWidth } = options;
  let cursorX = 0;
  let lineTop = options.startY;
  let lineHeight = Math.max(resolvedLineHeight(container.style), 0);
  let totalHeight = 0;
  const lineItems: InlineMetrics[] = [];

  const offsets = () => floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
  let inlineOffset = offsets();
  let availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);

  container.establishesIFC = true;

  const commitLine = () => {
    if (lineItems.length === 0) {
      return;
    }
    for (const item of lineItems) {
      placeInlineItem(item, contentX + inlineOffset.start, lineTop);
    }
    totalHeight += lineHeight;
    lineTop += lineHeight;
    cursorX = 0;
    lineHeight = Math.max(resolvedLineHeight(container.style), 0);
    lineItems.length = 0;
    inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
    availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
  };

  for (const node of inlineNodes) {
    const metrics = measureInlineNode(node, contentWidth, context);

    while (true) {
      if (availableWidth <= 0) {
        const nextLineTop = floatContext.nextUnblockedY(lineTop, lineTop + lineHeight);
        if (nextLineTop === null) {
          break;
        }
        lineTop = nextLineTop;
        inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
        availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
        cursorX = 0;
        continue;
      }

      if (cursorX > 0 && cursorX + metrics.outerWidth > availableWidth) {
        commitLine();
        inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
        availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
        continue;
      }

      if (cursorX === 0 && metrics.outerWidth > availableWidth) {
        const nextLineTop = floatContext.nextUnblockedY(lineTop, lineTop + lineHeight);
        if (nextLineTop === null) {
          break;
        }
        lineTop = nextLineTop;
        inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
        availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
        cursorX = 0;
        continue;
      }

      lineItems.push(metrics);
      cursorX += metrics.outerWidth;
      lineHeight = Math.max(lineHeight, metrics.outerHeight, resolvedLineHeight(container.style));
      break;
    }
  }

  if (lineItems.length > 0) {
    commitLine();
  }

  return { newCursorY: lineTop };
}

function measureInlineNode(node: LayoutNode, containerWidth: number, context: LayoutContext): InlineMetrics {
  if (node.style.display === Display.InlineBlock || node.style.display === Display.InlineFlex || node.style.display === Display.InlineGrid || node.style.display === Display.InlineTable) {
    context.layoutChild(node);
  }

  const marginLeft = resolveLength(node.style.marginLeft, containerWidth, { auto: "zero" });
  const marginRight = resolveLength(node.style.marginRight, containerWidth, { auto: "zero" });
  const marginTop = resolveLength(node.style.marginTop, containerWidth, { auto: "zero" });
  const marginBottom = resolveLength(node.style.marginBottom, containerWidth, { auto: "zero" });

  let contentWidth = node.box.contentWidth;
  if (contentWidth === 0) {
    if (typeof node.style.width === "number") {
      contentWidth = node.style.width;
    } else if (node.style.width !== "auto") {
      contentWidth = resolveLength(node.style.width, containerWidth, { auto: "zero" });
    } else if (node.intrinsicInlineSize !== undefined) {
      contentWidth = node.intrinsicInlineSize;
    } else {
      contentWidth = resolvedLineHeight(node.style);
    }
  }

  let contentHeight = node.box.contentHeight;
  if (contentHeight === 0) {
    if (node.style.height !== "auto") {
      contentHeight = resolveLength(node.style.height, containerWidth, { auto: "zero" });
    } else if (node.intrinsicBlockSize !== undefined) {
      contentHeight = node.intrinsicBlockSize;
    } else {
      contentHeight = resolvedLineHeight(node.style);
    }
  }

  const paddingLeft = resolveLength(node.style.paddingLeft, containerWidth, { auto: "zero" });
  const paddingRight = resolveLength(node.style.paddingRight, containerWidth, { auto: "zero" });
  const paddingTop = resolveLength(node.style.paddingTop, containerWidth, { auto: "zero" });
  const paddingBottom = resolveLength(node.style.paddingBottom, containerWidth, { auto: "zero" });

  const borderLeft = resolveLength(node.style.borderLeft, containerWidth, { auto: "zero" });
  const borderRight = resolveLength(node.style.borderRight, containerWidth, { auto: "zero" });
  const borderTop = resolveLength(node.style.borderTop, containerWidth, { auto: "zero" });
  const borderBottom = resolveLength(node.style.borderBottom, containerWidth, { auto: "zero" });

  node.box.contentWidth = contentWidth;
  node.box.contentHeight = contentHeight;
  node.box.borderBoxWidth = contentWidth + paddingLeft + paddingRight + borderLeft + borderRight;
  node.box.borderBoxHeight = contentHeight + paddingTop + paddingBottom + borderTop + borderBottom;
  node.box.marginBoxWidth = node.box.borderBoxWidth + marginLeft + marginRight;
  node.box.marginBoxHeight = node.box.borderBoxHeight + marginTop + marginBottom;
  node.box.scrollWidth = node.box.contentWidth;
  node.box.scrollHeight = node.box.contentHeight;

  return {
    node,
    contentWidth,
    contentHeight,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    borderLeft,
    borderRight,
    borderTop,
    borderBottom,
    outerWidth: node.box.marginBoxWidth,
    outerHeight: node.box.marginBoxHeight,
  };
}

function placeInlineItem(item: InlineMetrics, lineStartX: number, lineTop: number): void {
  const { node } = item;
  const contentX = lineStartX + item.marginLeft + item.borderLeft + item.paddingLeft;
  const contentY = lineTop + item.marginTop + item.borderTop + item.paddingTop;

  node.box.x = contentX;
  node.box.y = contentY;
  node.box.baseline = contentY + item.contentHeight;
}
