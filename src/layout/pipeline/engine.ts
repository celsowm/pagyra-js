import { LayoutNode } from "../../dom/node.js";
import type { Viewport } from "../../geometry/box.js";
import { LayoutEnvironment } from "../context/layout-environment.js";
import type { LayoutStrategy, LayoutContext } from "./strategy.js";
import { Position } from "../../css/enums.js";
import { containingBlock } from "../utils/node-math.js";
import { resolveLength, isAutoLength } from "../../css/length.js";
import { assignIntrinsicTextMetrics } from "../utils/text-metrics.js";

export interface LayoutEngineOptions {
  strategies: readonly LayoutStrategy[];
}

export class LayoutEngine {
  private readonly strategies: readonly LayoutStrategy[];

  constructor(options: LayoutEngineOptions) {
    this.strategies = options.strategies;
  }

  layoutTree(root: LayoutNode, viewport: Viewport): LayoutNode {
    const environment = new LayoutEnvironment({ viewport });
    const context: LayoutContext = {
      env: environment,
      layoutChild: (node: LayoutNode) => {
        this.layoutNodeInternal(node, context);
      },
    };

    assignIntrinsicTextMetrics(root);

    root.box.x = 0;
    root.box.y = 0;
    root.box.contentWidth = viewport.width;
    root.box.contentHeight = viewport.height;

    this.layoutNodeInternal(root, context);
    this.layoutOutOfFlowNodes(root, context);
    // Fragmentation is not yet implemented - placeholder for future expansion.
    return root;
  }

  private layoutNodeInternal(node: LayoutNode, context: LayoutContext): void {
    const strategy = this.strategies.find((s) => s.canLayout(node));
    if (!strategy) {
      throw new Error(`No layout strategy available for display: ${node.style.display}`);
    }
    strategy.layout(node, context);
  }

  private layoutOutOfFlowNodes(root: LayoutNode, context: LayoutContext): void {
    const positionedNodes: LayoutNode[] = [];
    root.walk((node) => {
      if (node.style.position === Position.Absolute || node.style.position === Position.Fixed) {
        positionedNodes.push(node);
      }
    });
    for (const node of positionedNodes) {
      this.layoutNodeInternal(node, context);
      this.layoutAbsoluteOrFixed(node, context);
    }
  }

  private layoutAbsoluteOrFixed(node: LayoutNode, context: LayoutContext): void {
    const cb = containingBlock(node, context.env.viewport);
    const widthRef = cb.width;
    const heightRef = cb.height;

    const resolveInset = (value: typeof node.style.left, reference: number): number | undefined => {
      if (value === undefined || isAutoLength(value)) {
        return undefined;
      }
      return resolveLength(value, reference, { auto: "zero" });
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
