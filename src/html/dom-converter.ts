// src/html/dom-converter.ts

import { type DomEl, type CssRuleEntry } from "./css/parse-css.js";
import { LayoutNode } from "../dom/node.js";
import { ComputedStyle } from "../css/style.js";
import { computeStyleForElement } from "../css/compute-style.js";
import { convertImageElement, type ConversionContext } from "./image-converter.js";
import { Display } from "../css/enums.js";

export async function convertDomNode(
  node: Node,
  cssRules: CssRuleEntry[],
  parentStyle: ComputedStyle,
  context: ConversionContext,
): Promise<LayoutNode | null> {
  console.log("convertDomNode - entering function for node type:", node.nodeType, "tagName:", (node as any).tagName || 'text node');
  if (node.nodeType === node.TEXT_NODE) {
    const raw = node.textContent ?? "";
    const collapsed = raw.replace(/\s+/g, " ");
    const text = collapsed.normalize("NFC").trim();
    console.log("convertDomNode - processing text node:", text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    if (!text) return null;
    const textStyle = new ComputedStyle({
      display: Display.Inline,
      color: parentStyle.color,
      fontSize: parentStyle.fontSize,
      lineHeight: parentStyle.lineHeight,
      fontFamily: parentStyle.fontFamily,
      fontWeight: parentStyle.fontWeight,
    });
    return new LayoutNode(textStyle, [], { textContent: text });
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

  if (tagName === "br") {
    const textStyle = new ComputedStyle({
      display: Display.Inline,
      color: parentStyle.color,
      fontSize: parentStyle.fontSize,
      lineHeight: parentStyle.lineHeight,
      fontFamily: parentStyle.fontFamily,
      fontWeight: parentStyle.fontWeight,
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
        normalized = layoutChildren.length > 0 ? " " : "";
      }
      if (normalized) {
        layoutChildren.push(new LayoutNode(new ComputedStyle({
          display: Display.Inline,
          color: ownStyle.color,
          fontSize: ownStyle.fontSize,
          lineHeight: ownStyle.lineHeight,
          fontFamily: ownStyle.fontFamily,
          fontWeight: ownStyle.fontWeight,
          textDecorationLine: ownStyle.textDecorationLine,
        }), [], { textContent: normalized }));
      }
      textBuf = "";
    }
    const sub = await convertDomNode(child, cssRules, ownStyle, context);
    if (sub) layoutChildren.push(sub);
  }
  if (textBuf) {
    let normalized = textBuf.replace(/\s+/g, " ").normalize("NFC");
    if (normalized.trim().length === 0) {
      normalized = layoutChildren.length > 0 ? " " : "";
    }
    if (normalized) {
      layoutChildren.push(new LayoutNode(new ComputedStyle({
        display: Display.Inline,
        color: ownStyle.color,
        fontSize: ownStyle.fontSize,
        lineHeight: ownStyle.lineHeight,
        fontFamily: ownStyle.fontFamily,
        fontWeight: ownStyle.fontWeight,
        textDecorationLine: ownStyle.textDecorationLine,
      }), [], { textContent: normalized }));
    }
  }

  return new LayoutNode(ownStyle, layoutChildren, { tagName });
}
