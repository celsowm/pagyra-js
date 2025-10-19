import { LayoutNode } from "../../dom/node.js";
import { Display, FloatMode } from "../../css/enums.js";
import { resolvedLineHeight } from "../../css/style.js";
import { clampMinMax, resolveLength } from "../../css/length.js";
import { FloatContext } from "../context/float-context.js";
import type { LayoutContext } from "../pipeline/strategy.js";
import { breakTextIntoLines } from "../../text/line-breaker.js";

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
  lineOffset: number;
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

      metrics.lineOffset = cursorX;
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

  const inlineChildrenResult = layoutInlineChildrenIfNeeded(node, containerWidth, context);

  let contentWidth = node.box.contentWidth;
  let contentHeight = node.box.contentHeight;

  if (node.textContent && node.style.display === Display.Inline) {
    const availableWidth = containerWidth;
    const lines = breakTextIntoLines(node.textContent, node.style, availableWidth);
    node.lineBoxes = lines;

    if (lines.length > 0) {
      const lineHeight = resolvedLineHeight(node.style);
      contentHeight = lines.length * lineHeight;
      contentWidth = Math.max(...lines.map(l => l.width));
    } else {
      contentHeight = 0;
      contentWidth = 0;
    }
  } 
  else if (inlineChildrenResult) {
    contentWidth = Math.max(contentWidth, inlineChildrenResult.contentWidth);
    contentHeight = Math.max(contentHeight, inlineChildrenResult.contentHeight);
  }

  if (node.style.display === Display.InlineBlock && node.style.width === "auto") {
    const intrinsicWidth = node.box.scrollWidth;
    if (Number.isFinite(intrinsicWidth) && intrinsicWidth > 0 && intrinsicWidth < contentWidth) {
      const minWidth = node.style.minWidth !== undefined ? resolveLength(node.style.minWidth, containerWidth, { auto: "zero" }) : undefined;
      const maxWidth = node.style.maxWidth !== undefined ? resolveLength(node.style.maxWidth, containerWidth, { auto: "reference" }) : undefined;
      const clamped = clampMinMax(intrinsicWidth, minWidth, maxWidth);
      contentWidth = Math.min(clamped, contentWidth);
    }
  }
  
  if (contentWidth === 0 && !node.textContent) {
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

  if (contentHeight === 0 && !node.textContent) {
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
  node.box.scrollWidth = Math.max(node.box.scrollWidth, node.box.contentWidth);
  node.box.scrollHeight = Math.max(node.box.scrollHeight, node.box.contentHeight);

  return {
    node,
    contentWidth,
    contentHeight,
    lineOffset: 0,
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
  const contentX = lineStartX + item.lineOffset + item.marginLeft + item.borderLeft + item.paddingLeft;
  const contentY = lineTop + item.marginTop + item.borderTop + item.paddingTop;

  const previousX = node.box.x;
  const previousY = node.box.y;

  node.box.x = contentX;
  node.box.y = contentY;
  node.box.baseline = contentY + item.contentHeight;

  const deltaX = node.box.x - previousX;
  const deltaY = node.box.y - previousY;
  if (deltaX !== 0 || deltaY !== 0) {
    offsetInlineDescendants(node, deltaX, deltaY);
  }
}

function layoutInlineChildrenIfNeeded(
  node: LayoutNode,
  containerWidth: number,
  context: LayoutContext,
): { contentWidth: number; contentHeight: number } | null {
  if (!shouldLayoutInlineChildren(node)) {
    return null;
  }

  const inlineChildren = collectInlineParticipants(node);
  if (inlineChildren.length === 0) {
    return null;
  }

  const savedX = node.box.x;
  const savedY = node.box.y;
  node.box.x = 0;
  node.box.y = 0;

  for (const child of inlineChildren) {
    child.box.x = 0;
    child.box.y = 0;
  }

  const localFloatContext = new FloatContext();
  const result = layoutInlineFormattingContext({
    container: node,
    inlineNodes: inlineChildren,
    context,
    floatContext: localFloatContext,
    contentX: 0,
    contentWidth: Math.max(containerWidth, 0),
    startY: 0,
  });

  const floatBottom = Math.max(localFloatContext.bottom("left"), localFloatContext.bottom("right"));
  const contentHeight = Math.max(result.newCursorY, floatBottom);

  let maxInlineEnd = 0;
  for (const child of inlineChildren) {
    const extent = inlineExtentWithinContainer(child, containerWidth);
    maxInlineEnd = Math.max(maxInlineEnd, extent.end);
  }

  node.box.x = savedX;
  node.box.y = savedY;

  return {
    contentWidth: Math.max(0, maxInlineEnd),
    contentHeight: Math.max(0, contentHeight),
  };
}

function shouldLayoutInlineChildren(node: LayoutNode): boolean {
  if (node.children.length === 0) {
    return false;
  }
  if (node.style.display !== Display.Inline) {
    return false;
  }
  return true;
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

function inlineExtentWithinContainer(node: LayoutNode, referenceWidth: number): { start: number; end: number } {
  const marginLeft = resolveLength(node.style.marginLeft, referenceWidth, { auto: "zero" });
  const marginRight = resolveLength(node.style.marginRight, referenceWidth, { auto: "zero" });
  const paddingLeft = resolveLength(node.style.paddingLeft, referenceWidth, { auto: "zero" });
  const paddingRight = resolveLength(node.style.paddingRight, referenceWidth, { auto: "zero" });
  const borderLeft = resolveLength(node.style.borderLeft, referenceWidth, { auto: "zero" });
  const borderRight = resolveLength(node.style.borderRight, referenceWidth, { auto: "zero" });

  const marginStart = node.box.x - paddingLeft - borderLeft - marginLeft;
  const width =
    node.box.contentWidth + paddingLeft + paddingRight + borderLeft + borderRight + marginLeft + marginRight;

  return {
    start: marginStart,
    end: marginStart + width,
  };
}

function offsetInlineDescendants(node: LayoutNode, deltaX: number, deltaY: number): void {
  node.walk((child) => {
    if (child === node) {
      return;
    }
    child.box.x += deltaX;
    child.box.y += deltaY;
    child.box.baseline += deltaY;
  }, false);
}
