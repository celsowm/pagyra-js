import type { LayoutNode } from "../../dom/node.js";
import { Position } from "../../css/enums.js";
import { resolveLength, isAutoLength } from "../../css/length.js";
import type { LayoutContext } from "./strategy.js";
import { containingBlock } from "../utils/node-math.js";
import type { LayoutEnvironment } from "../context/layout-environment.js";

export interface OutOfFlowManager {
  layoutOutOfFlow(
    root: LayoutNode,
    context: LayoutContext,
    dispatcher: (node: LayoutNode, context: LayoutContext) => void
  ): void;
}

export class DefaultOutOfFlowManager implements OutOfFlowManager {
  layoutOutOfFlow(
    root: LayoutNode,
    context: LayoutContext,
    dispatcher: (node: LayoutNode, context: LayoutContext) => void
  ): void {
    const positionedNodes: LayoutNode[] = [];
    root.walk((node) => {
      if (node.style.position === Position.Absolute || node.style.position === Position.Fixed) {
        positionedNodes.push(node);
      }
    });
    for (const node of positionedNodes) {
      dispatcher(node, context);
      this.positionAbsoluteOrFixed(node, context.env);
    }
  }

  private positionAbsoluteOrFixed(node: LayoutNode, env: LayoutEnvironment): void {
    const cb = containingBlock(node, env.viewport);
    const widthRef = cb.width;
    const heightRef = cb.height;
    const containerRefs = { containerWidth: widthRef, containerHeight: heightRef };

    const resolveInset = (value: typeof node.style.left, reference: number): number | undefined => {
      if (value === undefined || isAutoLength(value)) {
        return undefined;
      }
      return resolveLength(value, reference, { auto: "zero", ...containerRefs });
    };

    const left = resolveInset(node.style.left, widthRef);
    const right = resolveInset(node.style.right, widthRef);
    const top = resolveInset(node.style.top, heightRef);
    const bottom = resolveInset(node.style.bottom, heightRef);

    const borderBoxWidth = node.box.borderBoxWidth || node.box.contentWidth;
    const borderBoxHeight = node.box.borderBoxHeight || node.box.contentHeight;
    const measuredWidth = node.box.marginBoxWidth || borderBoxWidth;
    const measuredHeight = node.box.marginBoxHeight || borderBoxHeight;

    let x = cb.x;
    if (left !== undefined) {
      x = cb.x + left;
    } else if (right !== undefined) {
      x = cb.x + cb.width - measuredWidth - right;
    }

    let y = cb.y;
    if (top !== undefined) {
      y = cb.y + top;
    } else if (bottom !== undefined) {
      y = cb.y + cb.height - measuredHeight - bottom;
    }

    node.box.x = x;
    node.box.y = y;
  }
}
