import { LayoutNode } from "../../dom/node.js";
import { ComputedStyle } from "../../css/style.js";
import { cloneLineHeight } from "../../css/line-height.js";
import { Display, WhiteSpace } from "../../css/enums.js";
import type { InterBlockWhitespaceMode } from "../../html-to-pdf/types.js";

const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "canvas", "dd", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4",
  "h5", "h6", "header", "hr", "li", "main", "nav", "noscript", "ol", "p", "pre",
  "section", "table", "tbody", "thead", "tfoot", "tr", "td", "th", "ul", "video",
]);

interface TextConversionOptions {
  interBlockWhitespace?: InterBlockWhitespaceMode;
}

function findMeaningfulSibling(start: Node | null, direction: "previous" | "next"): Node | null {
  let current = start;
  const getNext = direction === "previous"
    ? (node: Node) => node.previousSibling
    : (node: Node) => node.nextSibling;
  while (current) {
    if (current.nodeType === current.TEXT_NODE) {
      const content = current.textContent ?? "";
      if (content.replace(/\s+/g, "").length > 0) {
        return current;
      }
    } else if (current.nodeType === current.ELEMENT_NODE) {
      const tagName = (current as Element).tagName.toLowerCase();
      if (!["script", "style", "meta", "link"].includes(tagName)) {
        return current;
      }
    }
    current = getNext(current);
  }
  return null;
}

function isInlineDisplay(display: Display): boolean {
  return (
    display === Display.Inline ||
    display === Display.InlineBlock ||
    display === Display.InlineFlex ||
    display === Display.InlineGrid ||
    display === Display.InlineTable
  );
}

export function isGridOrFlexContainer(display: Display): boolean {
  return (
    display === Display.Grid ||
    display === Display.InlineGrid ||
    display === Display.Flex ||
    display === Display.InlineFlex
  );
}

export function shouldPreserveCollapsedWhitespace(children: LayoutNode[], style: ComputedStyle): boolean {
  if (isGridOrFlexContainer(style.display)) {
    return false;
  }
  if (style.whiteSpace === WhiteSpace.Pre || style.whiteSpace === WhiteSpace.PreWrap) {
    return true;
  }
  const lastChild = children.length > 0 ? children[children.length - 1] : null;
  return !!lastChild && isInlineDisplay(lastChild.style.display);
}

export function createInlineTextStyle(parentStyle: ComputedStyle): ComputedStyle {
  return new ComputedStyle({
    display: Display.Inline,
    color: parentStyle.color,
    fontSize: parentStyle.fontSize,
    lineHeight: cloneLineHeight(parentStyle.lineHeight),
    fontFamily: parentStyle.fontFamily,
    fontWeight: parentStyle.fontWeight,
    fontStyle: parentStyle.fontStyle,
    letterSpacing: parentStyle.letterSpacing,
    wordSpacing: parentStyle.wordSpacing,
    overflowWrap: parentStyle.overflowWrap,
    wordBreak: parentStyle.wordBreak,
    whiteSpace: parentStyle.whiteSpace,
    textDecorationLine: parentStyle.textDecorationLine,
    textDecorationColor: parentStyle.textDecorationColor,
    textDecorationStyle: parentStyle.textDecorationStyle,
    textTransform: parentStyle.textTransform,
    transform: parentStyle.transform,
    textShadows: parentStyle.textShadows,
  });
}

export function createInlineTextLayoutNode(
  text: string,
  parentStyle: ComputedStyle,
  preserveLeadingSpace: boolean,
  preserveTrailingSpace: boolean,
): LayoutNode {
  return new LayoutNode(createInlineTextStyle(parentStyle), [], {
    textContent: text,
    customData: {
      preserveLeadingSpace,
      preserveTrailingSpace,
    },
  });
}

export function createGeneratedTextNode(text: string, parentStyle: ComputedStyle): LayoutNode | null {
  if (text.length === 0) {
    return null;
  }
  return createInlineTextLayoutNode(text, parentStyle, true, true);
}

export function convertTextDomNode(
  node: Node,
  parentStyle: ComputedStyle,
  options: TextConversionOptions = {},
): LayoutNode | null {
  const raw = node.textContent ?? "";
  const collapsed = raw.replace(/\s+/g, " ").normalize("NFC");
  const trimmed = collapsed.trim();

  const prev = findMeaningfulSibling(node.previousSibling, "previous");
  const next = findMeaningfulSibling(node.nextSibling, "next");
  const hasPrev = prev !== null;
  const hasNext = next !== null;
  const interBlockWhitespace = options.interBlockWhitespace ?? "collapse";

  const preserveLeadingCandidate = collapsed.startsWith(" ") && hasPrev;
  const preserveTrailingCandidate = collapsed.endsWith(" ") && hasNext;
  const preserveLeading =
    preserveLeadingCandidate && shouldKeepBoundarySpace(prev, interBlockWhitespace, parentStyle);
  const preserveTrailing =
    preserveTrailingCandidate && shouldKeepBoundarySpace(next, interBlockWhitespace, parentStyle);

  if (trimmed.length === 0) {
    if (isGridOrFlexContainer(parentStyle.display)) {
      return null;
    }
    const keepSpace =
      hasPrev &&
      hasNext &&
      (interBlockWhitespace === "preserve" || shouldKeepInterSiblingWhitespace(prev, next, parentStyle));
    if (!keepSpace) {
      return null;
    }
    return createInlineTextLayoutNode(" ", parentStyle, true, true);
  }

  let text = trimmed;

  if (preserveLeading) {
    text = " " + text;
  }
  if (preserveTrailing) {
    text = text + " ";
  }

  return createInlineTextLayoutNode(text, parentStyle, preserveLeading, preserveTrailing);
}

function shouldKeepBoundarySpace(
  sibling: Node | null,
  mode: InterBlockWhitespaceMode,
  parentStyle: ComputedStyle,
): boolean {
  if (mode === "preserve") {
    return true;
  }
  if (isInlineDisplay(parentStyle.display)) {
    return true;
  }
  return isInlineLikeNode(sibling);
}

function shouldKeepInterSiblingWhitespace(
  prev: Node | null,
  next: Node | null,
  parentStyle: ComputedStyle,
): boolean {
  if (isInlineDisplay(parentStyle.display)) {
    return true;
  }
  return isInlineLikeNode(prev) && isInlineLikeNode(next);
}

function isInlineLikeNode(node: Node | null): boolean {
  if (!node) {
    return false;
  }
  if (node.nodeType === node.TEXT_NODE) {
    return true;
  }
  if (node.nodeType !== node.ELEMENT_NODE) {
    return false;
  }
  const tagName = (node as Element).tagName.toLowerCase();
  return !BLOCK_TAGS.has(tagName);
}

export function flushBufferedText(
  layoutChildren: LayoutNode[],
  textBuffer: string,
  ownStyle: ComputedStyle,
): string {
  if (!textBuffer) {
    return "";
  }

  let normalized = textBuffer.replace(/\s+/g, " ").normalize("NFC");
  if (normalized.trim().length === 0) {
    normalized = shouldPreserveCollapsedWhitespace(layoutChildren, ownStyle) ? " " : "";
  }
  if (!normalized) {
    return "";
  }

  const preserveLeading = normalized.startsWith(" ");
  const preserveTrailing = normalized.endsWith(" ");
  layoutChildren.push(createInlineTextLayoutNode(normalized, ownStyle, preserveLeading, preserveTrailing));
  return "";
}
