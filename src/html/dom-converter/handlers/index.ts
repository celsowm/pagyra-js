import type { LayoutNode } from "../../../dom/node.js";
import type { SpecialElementHandlerArgs } from "./types.js";
import { brHandler } from "./br-handler.js";
import { formControlHandler } from "./form-control-handler.js";
import { imgHandler } from "./img-handler.js";
import { svgHandler } from "./svg-handler.js";

const exactTagHandlers = new Map<string, (args: SpecialElementHandlerArgs) => Promise<LayoutNode | null> | LayoutNode | null>([
  ["img", imgHandler],
  ["svg", svgHandler],
  ["br", brHandler],
]);

export function isIgnoredElementTag(tagName: string): boolean {
  return tagName === "script" || tagName === "style";
}

export async function tryHandleSpecialElement(args: SpecialElementHandlerArgs): Promise<LayoutNode | null> {
  const exactHandler = exactTagHandlers.get(args.tagName);
  if (exactHandler) {
    return await exactHandler(args);
  }
  return await formControlHandler(args);
}
