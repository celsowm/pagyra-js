import { ComputedStyle } from "../../../css/style.js";
import { LayoutNode } from "../../../dom/node.js";
import type { CssRuleEntry, DomEl } from "../../css/parse-css.js";
import type { ConversionContext } from "../../image-converter.js";

export interface SpecialElementHandlerArgs {
  element: DomEl;
  tagName: string;
  cssRules: CssRuleEntry[];
  parentStyle: ComputedStyle;
  context: ConversionContext;
}

export type SpecialElementHandler = (args: SpecialElementHandlerArgs) => Promise<LayoutNode | null> | LayoutNode | null;
