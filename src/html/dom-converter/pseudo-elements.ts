import type { ComputedStyle } from "../../css/style.js";
import { evaluateContent } from "../../css/parsers/content-parser.js";
import { LayoutNode } from "../../dom/node.js";
import { applyCounterIncrements, applyCounterResets } from "../../layout/counter.js";
import { computeStyleForPseudoElement } from "../../css/compute-style.js";
import type { CssPseudoElement, CssRuleEntry, DomEl } from "../css/parse-css.js";
import type { ConversionContext } from "../image-converter.js";
import { hydrateBackgroundImages } from "./background-images.js";
import { createGeneratedTextNode } from "./text.js";

export function registerCounterScopeForNode(
  style: ComputedStyle,
  context: ConversionContext,
  parentScopeId: string | null,
): string | undefined {
  if (!context.counterContext) {
    return undefined;
  }
  const scopeId = context.counterContext.registerScope(parentScopeId);
  if (style.counterReset && style.counterReset.length > 0) {
    applyCounterResets(context.counterContext, style.counterReset, scopeId);
  }
  if (style.counterIncrement && style.counterIncrement.length > 0) {
    applyCounterIncrements(context.counterContext, style.counterIncrement, scopeId);
  }
  return scopeId;
}

export async function synthesizePseudoElement(
  element: DomEl,
  pseudoType: CssPseudoElement,
  cssRules: CssRuleEntry[],
  parentStyle: ComputedStyle,
  context: ConversionContext,
  parentCounterScopeId: string | null,
): Promise<LayoutNode | null> {
  const pseudoStyle = computeStyleForPseudoElement(
    element,
    cssRules,
    pseudoType,
    parentStyle,
    context.units,
    context.rootFontSize,
  );

  if (!pseudoStyle.content) {
    return null;
  }

  await hydrateBackgroundImages(pseudoStyle, context);

  const pseudoScopeId = registerCounterScopeForNode(pseudoStyle, context, parentCounterScopeId);
  const effectiveScopeId = pseudoScopeId ?? parentCounterScopeId;
  const generatedText = evaluateContent(pseudoStyle.content, {
    getCounter: (name) => context.counterContext?.getCounter(name, effectiveScopeId) ?? 0,
    getAttribute: (name) => element.getAttribute(name),
    quoteDepth: 0,
  });

  const children: LayoutNode[] = [];
  const textNode = createGeneratedTextNode(generatedText, pseudoStyle);
  if (textNode) {
    children.push(textNode);
  }

  const pseudoNode = new LayoutNode(pseudoStyle, children, {
    tagName: pseudoType,
    customData: {
      pseudoType: pseudoType === "::before" ? "before" : "after",
    },
  });
  if (pseudoScopeId) {
    pseudoNode.counterScopeId = pseudoScopeId;
  }

  return pseudoNode;
}
