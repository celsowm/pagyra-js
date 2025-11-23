import { FloatContext } from "../context/float-context.js";
import type { LayoutContext } from "../pipeline/strategy.js";
import type { LayoutNode } from "../../dom/node.js";
import { layoutInlineFormattingContext, type InlineLayoutResult } from "./inline-formatting.js";

export interface InlineFormattingRequest {
  container: LayoutNode;
  inlineNodes: LayoutNode[];
  context: LayoutContext;
  floatContext?: FloatContext;
  contentX: number;
  contentWidth: number;
  startY: number;
}

export class InlineFormatter {
  layout(request: InlineFormattingRequest): InlineLayoutResult {
    const floatContext = request.floatContext ?? new FloatContext();
    return layoutInlineFormattingContext({
      container: request.container,
      inlineNodes: request.inlineNodes,
      context: request.context,
      floatContext,
      contentX: request.contentX,
      contentWidth: request.contentWidth,
      startY: request.startY,
    });
  }
}

export const defaultInlineFormatter = new InlineFormatter();
