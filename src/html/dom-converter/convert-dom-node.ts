import { computeStyleForElement } from "../../css/compute-style.js";
import { ComputedStyle } from "../../css/style.js";
import { LayoutNode, type LayoutNodeOptions } from "../../dom/node.js";
import { log } from "../../logging/debug.js";
import type { ExtendedDomNode } from "../../types/core.js";
import type { CssRuleEntry, DomEl } from "../css/parse-css.js";
import type { ConversionContext } from "../image-converter.js";
import { hydrateBackgroundImages } from "./background-images.js";
import { isIgnoredElementTag, tryHandleSpecialElement } from "./handlers/index.js";
import { parseSpan } from "./helpers.js";
import { registerCounterScopeForNode, synthesizePseudoElement } from "./pseudo-elements.js";
import { convertTextDomNode } from "./text.js";

export async function convertDomNode(
  node: Node,
  cssRules: CssRuleEntry[],
  parentStyle: ComputedStyle,
  context: ConversionContext,
  parentCounterScopeId: string | null = context.rootCounterScopeId ?? null,
): Promise<LayoutNode | null> {
  const extendedNode = node as unknown as ExtendedDomNode;
  log("dom-converter", "debug", `convertDomNode - entering function for node type: ${node.nodeType}, tagName: ${extendedNode.tagName || "text node"}`);

  if (node.nodeType === node.TEXT_NODE) {
    const textNode = convertTextDomNode(node, parentStyle, {
      interBlockWhitespace: context.interBlockWhitespace ?? "collapse",
    });
    if (!textNode) {
      return null;
    }
    log("dom-converter", "debug", "convertDomNode - processing text node:", `${textNode.textContent?.substring(0, 50) ?? ""}${(textNode.textContent?.length ?? 0) > 50 ? "..." : ""}`);
    return textNode;
  }

  if (node.nodeType !== node.ELEMENT_NODE) return null;

  const element = node as unknown as DomEl;
  const tagName = element.tagName.toLowerCase();
  log("dom-converter", "debug", `convertDomNode - processing element: ${tagName}, with style attr: ${element.getAttribute("style")}`);

  if (isIgnoredElementTag(tagName)) return null;

  const specialElementNode = await tryHandleSpecialElement({
    element,
    tagName,
    cssRules,
    parentStyle,
    context,
  });
  if (specialElementNode) {
    return specialElementNode;
  }

  const ownStyle = computeStyleForElement(element, cssRules, parentStyle, context.units, context.rootFontSize);
  await hydrateBackgroundImages(ownStyle, context);
  log("dom-converter", "debug", "convertDomNode - computed style backgroundLayers:", ownStyle.backgroundLayers);

  if (element.tagName.toLowerCase() === "div" && element.getAttribute("style")?.includes("linear-gradient")) {
    log("dom-converter", "debug", "Found div with gradient style!");
  }

  const elementCounterScopeId = registerCounterScopeForNode(ownStyle, context, parentCounterScopeId) ?? undefined;
  const currentScopeId = elementCounterScopeId ?? parentCounterScopeId;

  const layoutChildren: LayoutNode[] = [];
  const beforePseudo = await synthesizePseudoElement(
    element,
    "::before",
    cssRules,
    ownStyle,
    context,
    currentScopeId,
  );
  if (beforePseudo) {
    layoutChildren.push(beforePseudo);
  }

  const childNodes = element.childNodes;
  if (!childNodes) {
    return new LayoutNode(ownStyle, [], { tagName });
  }

  for (const child of Array.from(childNodes) as Node[]) {
    const sub = await convertDomNode(child, cssRules, ownStyle, context, currentScopeId);
    if (sub) {
      layoutChildren.push(sub);
    }
  }

  const afterPseudo = await synthesizePseudoElement(
    element,
    "::after",
    cssRules,
    ownStyle,
    context,
    currentScopeId,
  );
  if (afterPseudo) {
    layoutChildren.push(afterPseudo);
  }

  const id = element.getAttribute("id");
  const options: LayoutNodeOptions = { tagName };
  if (tagName === "td" || tagName === "th") {
    options.tableColSpan = parseSpan(element.getAttribute("colspan")) ?? 1;
    options.tableRowSpan = parseSpan(element.getAttribute("rowspan")) ?? 1;
  }
  if (id) {
    options.customData = { ...options.customData, id };
  }

  const layoutNode = new LayoutNode(ownStyle, layoutChildren, options);
  if (elementCounterScopeId) {
    layoutNode.counterScopeId = elementCounterScopeId;
  }
  return layoutNode;
}
