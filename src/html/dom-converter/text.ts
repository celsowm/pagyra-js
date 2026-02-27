import { LayoutNode } from "../../dom/node.js";
import { ComputedStyle } from "../../css/style.js";
import { cloneLineHeight } from "../../css/line-height.js";
import { Display, WhiteSpace } from "../../css/enums.js";

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

function hasMeaningfulPreviousSibling(node: Node): boolean {
  return findMeaningfulSibling(node.previousSibling, "previous") !== null;
}

function hasMeaningfulNextSibling(node: Node): boolean {
  return findMeaningfulSibling(node.nextSibling, "next") !== null;
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

export function convertTextDomNode(node: Node, parentStyle: ComputedStyle): LayoutNode | null {
  const raw = node.textContent ?? "";
  const collapsed = raw.replace(/\s+/g, " ").normalize("NFC");
  const trimmed = collapsed.trim();

  const hasPrev = hasMeaningfulPreviousSibling(node);
  const hasNext = hasMeaningfulNextSibling(node);

  if (trimmed.length === 0) {
    if (isGridOrFlexContainer(parentStyle.display)) {
      return null;
    }
    const keepSpace = hasPrev && hasNext;
    if (!keepSpace) {
      return null;
    }
    return createInlineTextLayoutNode(" ", parentStyle, true, true);
  }

  let text = trimmed;
  const preserveLeading = collapsed.startsWith(" ") && hasPrev;
  const preserveTrailing = collapsed.endsWith(" ") && hasNext;

  if (preserveLeading) {
    text = " " + text;
  }
  if (preserveTrailing) {
    text = text + " ";
  }

  return createInlineTextLayoutNode(text, parentStyle, preserveLeading, preserveTrailing);
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
