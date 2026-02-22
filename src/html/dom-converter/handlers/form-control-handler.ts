import { computeStyleForElement } from "../../../css/compute-style.js";
import { ComputedStyle } from "../../../css/style.js";
import { LayoutNode, type LayoutNodeOptions } from "../../../dom/node.js";
import { defaultFormRegistry, extractFormControlData } from "../../../dom/form-registry.js";
import type { SvgElement } from "../../../types/core.js";
import { hydrateBackgroundImages } from "../background-images.js";
import type { SpecialElementHandler } from "./types.js";

async function createFormControlNode(
  element: Parameters<SpecialElementHandler>[0]["element"],
  tagName: string,
  cssRules: Parameters<SpecialElementHandler>[0]["cssRules"],
  parentStyle: ComputedStyle,
  context: Parameters<SpecialElementHandler>[0]["context"],
): Promise<LayoutNode | null> {
  if (!defaultFormRegistry.isFormElement(tagName)) {
    return null;
  }

  const formControlData = extractFormControlData(element as SvgElement, tagName);
  if (!formControlData) {
    return null;
  }

  const ownStyle = computeStyleForElement(element, cssRules, parentStyle, context.units, context.rootFontSize);
  await hydrateBackgroundImages(ownStyle, context);

  const options: LayoutNodeOptions = { tagName };
  const id = element.getAttribute("id");
  if (id) {
    options.customData = { id, formControl: formControlData };
  } else {
    options.customData = { formControl: formControlData };
  }

  return new LayoutNode(ownStyle, [], options);
}

export const formControlHandler: SpecialElementHandler = async ({ element, tagName, cssRules, parentStyle, context }) => {
  return await createFormControlNode(element, tagName, cssRules, parentStyle, context);
};
