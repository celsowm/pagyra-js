// src/html/dom-converter.ts

import { type DomEl, type CssRuleEntry } from "./css/parse-css.js";
import { LayoutNode } from "../dom/node.js";
import { ComputedStyle } from "../css/style.js";
import { computeStyleForElement } from "../css/compute-style.js";
import { convertImageElement, type ConversionContext } from "./image-converter.js";
import { Display, WhiteSpace } from "../css/enums.js";
import { parseSvg } from "../svg/parser.js";
import type { SvgRootNode } from "../svg/types.js";

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

function shouldPreserveCollapsedWhitespace(children: LayoutNode[], style: ComputedStyle): boolean {
  if (style.whiteSpace === WhiteSpace.Pre || style.whiteSpace === WhiteSpace.PreWrap) {
    return true;
  }
  const lastChild = children.length > 0 ? children[children.length - 1] : null;
  return !!lastChild && isInlineDisplay(lastChild.style.display);
}

export async function convertDomNode(
  node: Node,
  cssRules: CssRuleEntry[],
  parentStyle: ComputedStyle,
  context: ConversionContext,
): Promise<LayoutNode | null> {
  console.log("convertDomNode - entering function for node type:", node.nodeType, "tagName:", (node as any).tagName || 'text node');
  if (node.nodeType === node.TEXT_NODE) {
    const raw = node.textContent ?? "";
    const collapsed = raw.replace(/\s+/g, " ").normalize("NFC");
    const trimmed = collapsed.trim();

    const hasPrev = hasMeaningfulPreviousSibling(node);
    const hasNext = hasMeaningfulNextSibling(node);

    if (trimmed.length === 0) {
      const keepSpace = hasPrev && hasNext;
      if (!keepSpace) {
        return null;
      }
      console.log("convertDomNode - processing text node: (single space)");
      const textStyle = new ComputedStyle({
        display: Display.Inline,
        color: parentStyle.color,
        fontSize: parentStyle.fontSize,
        lineHeight: parentStyle.lineHeight,
        fontFamily: parentStyle.fontFamily,
        fontWeight: parentStyle.fontWeight,
        fontStyle: parentStyle.fontStyle,
        textDecorationLine: parentStyle.textDecorationLine,
      });
      return new LayoutNode(textStyle, [], {
        textContent: " ",
        customData: {
          preserveLeadingSpace: true,
          preserveTrailingSpace: true,
        },
      });
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

    console.log("convertDomNode - processing text node:", text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    const textStyle = new ComputedStyle({
      display: Display.Inline,
      color: parentStyle.color,
      fontSize: parentStyle.fontSize,
      lineHeight: parentStyle.lineHeight,
      fontFamily: parentStyle.fontFamily,
      fontWeight: parentStyle.fontWeight,
      fontStyle: parentStyle.fontStyle,
      textDecorationLine: parentStyle.textDecorationLine,
    });
    return new LayoutNode(textStyle, [], {
      textContent: text,
      customData: {
        preserveLeadingSpace: preserveLeading,
        preserveTrailingSpace: preserveTrailing,
      },
    });
  }

  if (node.nodeType !== node.ELEMENT_NODE) return null;

  const element = node as DomEl;
  const tagName = element.tagName.toLowerCase();
  console.log("convertDomNode - processing element:", tagName, "with style attr:", element.getAttribute("style"));
  if (tagName === "script" || tagName === "style") return null;

  // Handle image elements
  if (tagName === "img") {
    return await convertImageElement(element, cssRules, parentStyle, context);
  }

  if (tagName === "svg") {
    const ownStyle = computeStyleForElement(element, cssRules, parentStyle, context.units);
    console.log("convertDomNode - computed style backgroundLayers:", ownStyle.backgroundLayers);
    const svgRoot = parseSvg(element, { warn: (message) => console.warn(`[svg-parser] ${message}`) });
    if (!svgRoot) {
      return new LayoutNode(ownStyle, [], { tagName });
    }
    const intrinsic = resolveSvgIntrinsicSize(svgRoot, element);
    return new LayoutNode(ownStyle, [], {
      tagName,
      intrinsicInlineSize: intrinsic.width,
      intrinsicBlockSize: intrinsic.height,
      customData: {
        svg: {
          root: svgRoot,
          intrinsicWidth: intrinsic.width,
          intrinsicHeight: intrinsic.height,
          // Propagate resource roots so SVG rendering can resolve image hrefs
          resourceBaseDir: context && (context as any).resourceBaseDir,
          assetRootDir: context && (context as any).assetRootDir,
        },
      },
    });
  }

  if (tagName === "br") {
    const textStyle = new ComputedStyle({
      display: Display.Inline,
      color: parentStyle.color,
      fontSize: parentStyle.fontSize,
      lineHeight: parentStyle.lineHeight,
      fontFamily: parentStyle.fontFamily,
      fontWeight: parentStyle.fontWeight,
      fontStyle: parentStyle.fontStyle,
    });
    return new LayoutNode(textStyle, [], { textContent: "\n" });
  }

  // ✅ Coalescing de #text
  const ownStyle = computeStyleForElement(element, cssRules, parentStyle, context.units);
  console.log("convertDomNode - computed style backgroundLayers:", ownStyle.backgroundLayers);
  
  // Log if this is the div element that should have the gradient
  if (element.tagName.toLowerCase() === 'div' && element.getAttribute("style")?.includes('linear-gradient')) {
    console.log("Found div with gradient style!");
  }
  const layoutChildren: LayoutNode[] = [];
  let textBuf = "";

  for (const child of Array.from(element.childNodes) as Node[]) {
    if (child.nodeType === child.TEXT_NODE) {
      textBuf += child.textContent ?? "";
      continue;
    }
    if (textBuf) {
      let normalized = textBuf.replace(/\s+/g, " ").normalize("NFC");
      if (normalized.trim().length === 0) {
        normalized = shouldPreserveCollapsedWhitespace(layoutChildren, ownStyle) ? " " : "";
      }
      if (normalized) {
        const preserveLeading = normalized.startsWith(" ");
        const preserveTrailing = normalized.endsWith(" ");
        layoutChildren.push(new LayoutNode(new ComputedStyle({
          display: Display.Inline,
          color: ownStyle.color,
          fontSize: ownStyle.fontSize,
          lineHeight: ownStyle.lineHeight,
          fontFamily: ownStyle.fontFamily,
          fontWeight: ownStyle.fontWeight,
          fontStyle: ownStyle.fontStyle,
          textDecorationLine: ownStyle.textDecorationLine,
        }), [], {
          textContent: normalized,
          customData: {
            preserveLeadingSpace: preserveLeading,
            preserveTrailingSpace: preserveTrailing,
          },
        }));
      }
      textBuf = "";
    }
    const sub = await convertDomNode(child, cssRules, ownStyle, context);
    if (sub) layoutChildren.push(sub);
  }
  if (textBuf) {
    let normalized = textBuf.replace(/\s+/g, " ").normalize("NFC");
    if (normalized.trim().length === 0) {
      normalized = shouldPreserveCollapsedWhitespace(layoutChildren, ownStyle) ? " " : "";
    }
    if (normalized) {
      const preserveLeading = normalized.startsWith(" ");
      const preserveTrailing = normalized.endsWith(" ");
      layoutChildren.push(new LayoutNode(new ComputedStyle({
        display: Display.Inline,
        color: ownStyle.color,
        fontSize: ownStyle.fontSize,
        lineHeight: ownStyle.lineHeight,
        fontFamily: ownStyle.fontFamily,
        fontWeight: ownStyle.fontWeight,
        fontStyle: ownStyle.fontStyle,
        textDecorationLine: ownStyle.textDecorationLine,
      }), [], {
        textContent: normalized,
        customData: {
          preserveLeadingSpace: preserveLeading,
          preserveTrailingSpace: preserveTrailing,
        },
      }));
    }
  }

  return new LayoutNode(ownStyle, layoutChildren, { tagName });
}

function resolveSvgIntrinsicSize(svg: SvgRootNode, element: Element): { width: number; height: number } {
  let width = svg.width;
  let height = svg.height;
  if (svg.viewBox) {
    if (!width || width <= 0) {
      width = svg.viewBox.width;
    }
    if (!height || height <= 0) {
      height = svg.viewBox.height;
    }
  }
  if (!width || width <= 0) {
    width = attributeToNumber(element.getAttribute("width")) ?? 100;
  }
  if (!height || height <= 0) {
    height = attributeToNumber(element.getAttribute("height")) ?? width;
  }
  return {
    width: Number.isFinite(width) && width > 0 ? width : 100,
    height: Number.isFinite(height) && height > 0 ? height : 100,
  };
}

function attributeToNumber(raw: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
}
