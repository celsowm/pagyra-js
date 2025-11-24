import { LayoutNode, type InlineRun } from "../../dom/node.js";
import { Display, FloatMode } from "../../css/enums.js";
import { resolvedLineHeight } from "../../css/style.js";
import { clampMinMax, resolveLength } from "../../css/length.js";
import { FloatContext } from "../context/float-context.js";
import type { LayoutContext } from "../pipeline/strategy.js";
import { estimateLineWidth, measureTextWithGlyphs } from "./text-metrics.js";
import { applyTextTransform } from "../../text/text-transform.js";
import { WhiteSpace } from "../../css/enums.js";
import type { FontEmbedder } from "../../pdf/font/embedder.js";

const LAYOUT_DEBUG = process.env.PAGYRA_DEBUG_LAYOUT === "1";
const layoutDebug = (...args: unknown[]): void => {
  if (LAYOUT_DEBUG) {
    // console.log(...args); // Removed as per task to remove non-recommended console.log
  }
};

interface InlineLayoutOptions {
  container: LayoutNode;
  inlineNodes: LayoutNode[];
  context: LayoutContext;
  floatContext: FloatContext;
  contentX: number;
  contentWidth: number;
  startY: number;
}

type InlineFragment =
  | {
      kind: "text";
      node: LayoutNode;
      style: LayoutNode["style"];
      text: string;
      preserveLeading?: boolean;
      preserveTrailing?: boolean;
    }
  | {
      kind: "box";
      metrics: InlineMetrics;
    };

type LayoutItemKind = "word" | "space" | "box" | "newline";

interface LayoutItemBase {
  kind: LayoutItemKind;
  width: number;
  height: number;
  lineHeight: number;
  node?: LayoutNode;
  style?: LayoutNode["style"];
  text?: string;
  spaceCount?: number;
}

interface BoxLayoutItem extends LayoutItemBase {
  kind: "box";
  metrics: InlineMetrics;
}

type LayoutItem = LayoutItemBase | BoxLayoutItem;

export interface InlineMetrics {
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

export interface InlineLayoutResult {
  newCursorY: number;
}

function resolveInlineTextAlign(node: LayoutNode): string | undefined {
  let current: LayoutNode | null = node;
  while (current) {
    const value = current.style.textAlign;
    if (value) {
      const normalized = value.toLowerCase();
      if (normalized !== "start" && normalized !== "auto") {
        return normalized;
      }
    }
    current = current.parent;
  }
  return undefined;
}

export function layoutInlineFormattingContext(options: InlineLayoutOptions): InlineLayoutResult {
  const { container, inlineNodes, context, floatContext, contentX, contentWidth } = options;
  container.establishesIFC = true;

  const textAlign = container.style.display === Display.Inline
    ? undefined
    : resolveInlineTextAlign(container);
  const shouldApplyTextIndent = container.style.display !== Display.Inline;
  const resolvedTextIndent = shouldApplyTextIndent
    ? resolveLength(container.style.textIndent, contentWidth, { auto: "zero" })
    : 0;
  let firstLineTextIndentPending = shouldApplyTextIndent && resolvedTextIndent !== 0;

  const fragments = collectInlineFragments(inlineNodes, contentWidth, context);
  const items = tokenizeFragments(fragments, context.env.fontEmbedder);

  let lineTop = options.startY;
  let lineHeight = Math.max(resolvedLineHeight(container.style), 0);
  let inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
  let availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
  let cursorX = 0;
  let lineIndex = 0;
  const lineParts: { item: LayoutItem; offset: number }[] = [];
  const nodeRuns = new Map<LayoutNode, InlineRun[]>();

  let maxInlineEnd = 0;

  const pushRun = (
    node: LayoutNode,
    run: InlineRun,
  ) => {
    const existing = nodeRuns.get(node);
    if (existing) {
      existing.push(run);
    } else {
      nodeRuns.set(node, [run]);
    }
  };

  const placeRunsForLine = (parts: { item: LayoutItem; offset: number }[], isLastLine: boolean) => {
    const trimmed = parts;
    if (trimmed.length === 0) {
      return;
    }

    const lineWidth = trimmed.reduce((max, part) => Math.max(max, part.offset + part.item.width), 0);
    const currentAvailableWidth = Math.max(availableWidth, 0);
    const slack = Math.max(currentAvailableWidth - lineWidth, 0);
    let offsetShift = 0;
    if (textAlign === "center") {
      offsetShift = slack / 2;
    } else if (textAlign === "right" || textAlign === "end") {
      offsetShift = slack;
    }

    const lineStartX = contentX + inlineOffset.start + offsetShift;
    const lineBaseline = lineTop + lineHeight;
    const spaceCount = trimmed.reduce((count, part) => {
      if (part.item.kind === "space") {
        return count + (part.item.spaceCount ?? 1);
      }
      return count;
    }, 0);
    maxInlineEnd = Math.max(maxInlineEnd, lineStartX + lineWidth - contentX);

    for (const part of trimmed) {
      if (isBoxItem(part.item)) {
        const metrics = part.item.metrics;
        metrics.lineOffset = part.offset + offsetShift;
        placeInlineItem(metrics, contentX + inlineOffset.start, lineTop);
        continue;
      }

      const node = part.item.node;
      if (!node || !part.item.text) {
        continue;
      }
      const startX = lineStartX + part.offset;
      const run: InlineRun = {
        lineIndex,
        startX,
        baseline: lineBaseline,
        text: part.item.text,
        width: part.item.width,
        lineWidth,
        targetWidth: currentAvailableWidth,
        spaceCount: spaceCount,
        isLastLine,
      };
      node.box.x = startX;
      node.box.y = lineTop;
      node.box.baseline = lineBaseline;
      pushRun(node, run);
    }
  };

  const commitLine = (isLastLine: boolean) => {
    if (lineParts.length === 0) {
      lineTop += lineHeight;
    } else {
      placeRunsForLine(lineParts, isLastLine);
      lineTop += lineHeight;
    }
    cursorX = 0;
    lineHeight = Math.max(resolvedLineHeight(container.style), 0);
    lineParts.length = 0;
    inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
    availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
    lineIndex += 1;
  };

  for (let index = 0; index < items.length; index++) {
    const item = items[index];

    if (item.kind === "newline") {
      commitLine(false);
      continue;
    }

    let workingItem: LayoutItem | null = item;

    while (workingItem) {
      if (availableWidth <= 0) {
        const nextLineTop = floatContext.nextUnblockedY(lineTop, lineTop + lineHeight);
        if (nextLineTop === null) {
          // No floats to skip; allow overflow on this line.
          availableWidth = Math.max(0, contentWidth);
          inlineOffset = { start: 0, end: contentWidth };
        } else {
          lineTop = nextLineTop;
          inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
          availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
          cursorX = 0;
          lineParts.length = 0;
          continue;
        }
      }

      if (lineParts.length === 0 && firstLineTextIndentPending) {
        cursorX += resolvedTextIndent;
        firstLineTextIndentPending = false;
      }

      const remaining = Math.max(availableWidth - cursorX, 0);

      if (workingItem.kind === "box") {
        if (lineParts.length > 0 && cursorX + workingItem.width > availableWidth) {
          commitLine(false);
          continue;
        }
        if (lineParts.length === 0 && workingItem.width > availableWidth) {
          const nextLineTop = floatContext.nextUnblockedY(lineTop, lineTop + lineHeight);
          if (nextLineTop === null) {
            lineParts.push({ item: workingItem, offset: cursorX });
            cursorX += workingItem.width;
            lineHeight = Math.max(lineHeight, workingItem.lineHeight);
            break;
          }
          lineTop = nextLineTop;
          inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
          availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
          cursorX = 0;
          lineParts.length = 0;
          continue;
        }

        lineParts.push({ item: workingItem, offset: cursorX });
        cursorX += workingItem.width;
        lineHeight = Math.max(lineHeight, workingItem.lineHeight);
        break;
      }

      // Text items
      if (workingItem.kind === "word" && workingItem.width > remaining) {
        const mode = workingItem.style?.overflowWrap ?? "normal";
        if (mode !== "normal" && remaining > 0) {
          const [head, tail] = splitWordItemToken(workingItem, remaining);
          if (head) {
            lineParts.push({ item: head, offset: cursorX });
            cursorX += head.width;
            lineHeight = Math.max(lineHeight, head.lineHeight);
          }
          if (tail) {
            items.splice(index + 1, 0, tail);
          }
          workingItem = null;
          break;
        }
      }

      if (lineParts.length > 0 && cursorX + workingItem.width > availableWidth) {
        commitLine(false);
        continue;
      }

      if (lineParts.length === 0 && workingItem.width > availableWidth && workingItem.kind === "word") {
        const nextLineTop = floatContext.nextUnblockedY(lineTop, lineTop + lineHeight);
        if (nextLineTop === null) {
          lineParts.push({ item: workingItem, offset: cursorX });
          cursorX += workingItem.width;
          lineHeight = Math.max(lineHeight, workingItem.lineHeight);
          workingItem = null;
          break;
        }
        lineTop = nextLineTop;
        inlineOffset = floatContext.inlineOffsets(lineTop, lineTop + lineHeight, contentWidth);
        availableWidth = Math.max(0, inlineOffset.end - inlineOffset.start);
        cursorX = 0;
        lineParts.length = 0;
        continue;
      }

      lineParts.push({ item: workingItem, offset: cursorX });
      cursorX += workingItem.width;
      lineHeight = Math.max(lineHeight, workingItem.lineHeight);
      workingItem = null;
    }
  }

  if (lineParts.length > 0) {
    commitLine(true);
  }

  // Assign runs back to nodes and compute per-node sizes for text.
  for (const [node, runs] of nodeRuns.entries()) {
    node.inlineRuns = runs;
    node.lineBoxes = undefined;
    const lineCount = runs.reduce((max, run) => Math.max(max, run.lineIndex + 1), 0);
    const lh = resolvedLineHeight(node.style);
    node.box.contentHeight = lineCount * lh;
    const maxWidth = runs.reduce((max, run) => Math.max(max, run.lineWidth ?? run.width), 0);
    node.box.contentWidth = maxWidth;
    node.box.borderBoxWidth = maxWidth;
    node.box.borderBoxHeight = node.box.contentHeight;
    node.box.marginBoxWidth = node.box.borderBoxWidth;
    node.box.marginBoxHeight = node.box.borderBoxHeight;
    node.box.scrollWidth = Math.max(node.box.scrollWidth, node.box.contentWidth);
    node.box.scrollHeight = Math.max(node.box.scrollHeight, node.box.contentHeight);
  }

  return { newCursorY: lineTop };
}

function collectInlineFragments(
  nodes: LayoutNode[],
  containerWidth: number,
  context: LayoutContext,
): InlineFragment[] {
  const fragments: InlineFragment[] = [];

  const recurse = (node: LayoutNode) => {
    if (node.style.display === Display.None) {
      return;
    }
    if (node.style.float !== FloatMode.None) {
      return;
    }

    if (isAtomicInline(node.style.display)) {
      const metrics = measureInlineNode(node, containerWidth, context);
      fragments.push({ kind: "box", metrics });
      return;
    }

    if (node.textContent && node.style.display === Display.Inline) {
      fragments.push({
        kind: "text",
        node,
        style: node.style,
        text: node.textContent,
        preserveLeading: !!node.customData?.preserveLeadingSpace,
        preserveTrailing: !!node.customData?.preserveTrailingSpace,
      });
      return;
    }

    for (const child of node.children) {
      if (!isInlineDisplay(child.style.display)) {
        continue;
      }
      recurse(child);
    }
  };

  for (const node of nodes) {
    recurse(node);
  }

  return fragments;
}

function tokenizeFragments(
  fragments: InlineFragment[],
  fontEmbedder: FontEmbedder | null,
): LayoutItem[] {
  const items: LayoutItem[] = [];
  for (const fragment of fragments) {
    if (fragment.kind === "box") {
      items.push({
        kind: "box",
        width: fragment.metrics.outerWidth,
        height: fragment.metrics.outerHeight,
        lineHeight: fragment.metrics.outerHeight,
        metrics: fragment.metrics,
      });
      continue;
    }

    const style = fragment.style;
    const raw = fragment.text ?? "";
    if (!raw) {
      continue;
    }
    const effectiveText = applyTextTransform(raw, style.textTransform);
    const lineHeight = resolvedLineHeight(style);
    const segments = segmentTextWithWhitespace(effectiveText, style.whiteSpace);
    for (const segment of segments) {
      if (segment.kind === "newline") {
        items.push({
          kind: "newline",
          width: 0,
          height: lineHeight,
          lineHeight,
        });
        continue;
      }
      const width = measureSegment(segment.text, style, fontEmbedder);
      items.push({
        kind: segment.kind,
        width,
        height: lineHeight,
        lineHeight,
        node: fragment.node,
        style,
        text: segment.text,
        spaceCount: segment.kind === "space" ? countSpaces(segment.text) : 0,
      });
    }
  }
  return items;
}

function measureSegment(text: string, style: LayoutNode["style"], fontEmbedder: FontEmbedder | null): number {
  const metrics = fontEmbedder?.getMetrics(style.fontFamily ?? "");
  const glyphWidth = measureTextWithGlyphs(text, style, metrics ?? null);
  return glyphWidth ?? estimateLineWidth(text, style);
}

function segmentTextWithWhitespace(
  text: string,
  mode: WhiteSpace,
): { kind: "word" | "space" | "newline"; text: string }[] {
  const segments: { kind: "word" | "space" | "newline"; text: string }[] = [];
  const regex = /(\n)|(\s+)|([^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      if (mode === WhiteSpace.Pre || mode === WhiteSpace.PreWrap || mode === WhiteSpace.PreLine) {
        segments.push({ kind: "newline", text: "\n" });
      } else {
        segments.push({ kind: "space", text: " " });
      }
    } else if (match[2]) {
      segments.push({ kind: "space", text: match[2] });
    } else if (match[3]) {
      segments.push({ kind: "word", text: match[3] });
    }
  }
  return segments;
}

function splitWordItemToken(item: LayoutItem, availableWidth: number): [LayoutItem | null, LayoutItem | null] {
  if (item.kind !== "word" || !item.text || !item.style) {
    return [item, null];
  }

  let buffer = "";
  let bufferWidth = 0;
  for (const char of Array.from(item.text)) {
    const candidate = buffer + char;
    const candidateWidth = estimateLineWidth(candidate, item.style);
    if (buffer && candidateWidth > availableWidth) {
      break;
    }
    buffer = candidate;
    bufferWidth = candidateWidth;
  }

  if (!buffer) {
    return [item, null];
  }

  const head: LayoutItem = {
    ...item,
    text: buffer,
    width: bufferWidth,
  };
  const tailText = item.text.slice(buffer.length);
  if (!tailText) {
    return [head, null];
  }
  const tail: LayoutItem = {
    ...item,
    text: tailText,
    width: estimateLineWidth(tailText, item.style),
  };
  return [head, tail];
}

function countSpaces(value: string): number {
  let count = 0;
  for (const char of value) {
    if (char === " ") {
      count += 1;
    }
  }
  return count;
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

  if (inlineChildrenResult) {
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
  layoutDebug(
    `[placeInlineItem] node=${node.tagName ?? "(anonymous)"} lineStartX=${lineStartX} lineOffset=${item.lineOffset} marginLeft=${item.marginLeft} paddingLeft=${item.paddingLeft} borderLeft=${item.borderLeft} -> contentX=${contentX}`,
  );

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

function isAtomicInline(display: Display): boolean {
  switch (display) {
    case Display.InlineBlock:
    case Display.InlineFlex:
    case Display.InlineGrid:
    case Display.InlineTable:
      return true;
    default:
      return false;
  }
}

function isBoxItem(item: LayoutItem): item is BoxLayoutItem {
  return item.kind === "box";
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
