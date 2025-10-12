import { LayoutNode } from "../../dom/node.js";
import { Display } from "../../css/enums.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import {
  containingBlock,
  establishesBFC,
  horizontalNonContent,
  horizontalMargin,
  inFlow,
  resolveWidthBlock,
  verticalNonContent,
} from "../utils/node-math.js";
import { resolveLength } from "../../css/length.js";
import { collapsedGapBetween } from "../utils/margin.js";
import { finalizeOverflow } from "../utils/overflow.js";

export class BlockLayoutStrategy implements LayoutStrategy {
  private readonly supportedDisplays = new Set<Display>([Display.Block, Display.FlowRoot, Display.InlineBlock]);

  canLayout(node: LayoutNode): boolean {
    return this.supportedDisplays.has(node.style.display);
  }

  layout(node: LayoutNode, context: LayoutContext): void {
    const cb = containingBlock(node, context.env.viewport);
    node.establishesBFC = establishesBFC(node);

    const contentWidth = resolveWidthBlock(node, cb.width);
    node.box.contentWidth = contentWidth;

    const horizontalExtras = horizontalNonContent(node, contentWidth);
    node.box.borderBoxWidth = contentWidth + horizontalExtras;
    node.box.marginBoxWidth = node.box.borderBoxWidth + horizontalMargin(node, contentWidth);

    const paddingLeft = resolveLength(node.style.paddingLeft, contentWidth, { auto: "zero" });
    const borderLeft = resolveLength(node.style.borderLeft, contentWidth, { auto: "zero" });
    const paddingTop = resolveLength(node.style.paddingTop, contentWidth, { auto: "zero" });
    const borderTop = resolveLength(node.style.borderTop, contentWidth, { auto: "zero" });

    let cursorY = cb.y + paddingTop + borderTop;
    let previousBottomMargin = 0;

    for (const child of node.children) {
      if (child.style.display === Display.None) {
        continue;
      }

      // Float handling is not yet implemented. For now, we treat floats as normal flow items.

      if (!inFlow(child)) {
        continue;
      }

      const childMarginTop = resolveLength(child.style.marginTop, contentWidth, { auto: "zero" });
      const gap = collapsedGapBetween(previousBottomMargin, childMarginTop, node.establishesBFC);
      cursorY += gap;

      context.layoutChild(child);

      const childMarginLeft = resolveLength(child.style.marginLeft, contentWidth, { auto: "zero" });
      const childMarginBottom = resolveLength(child.style.marginBottom, contentWidth, { auto: "zero" });
      const childNonContentVertical = verticalNonContent(child, contentWidth);

      const originX = node.box.x + borderLeft + paddingLeft + childMarginLeft;

      child.box.x = originX;
      child.box.y = cursorY;
      child.box.borderBoxHeight = child.box.contentHeight + childNonContentVertical;
      child.box.marginBoxHeight = child.box.borderBoxHeight + childMarginTop + childMarginBottom;
      previousBottomMargin = childMarginBottom;
      cursorY = child.box.y + child.box.borderBoxHeight + childMarginBottom;
    }

    node.box.contentHeight = Math.max(0, cursorY - (cb.y + borderTop) - paddingTop);
    const verticalExtras = verticalNonContent(node, contentWidth);
    node.box.borderBoxHeight = node.box.contentHeight + verticalExtras;
    node.box.marginBoxHeight =
      node.box.borderBoxHeight +
      resolveLength(node.style.marginTop, contentWidth, { auto: "zero" }) +
      resolveLength(node.style.marginBottom, contentWidth, { auto: "zero" });

    finalizeOverflow(node);
  }
}
