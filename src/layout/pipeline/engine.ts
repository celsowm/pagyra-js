import { LayoutNode } from "../../dom/node.js";
import type { Viewport } from "../../geometry/box.js";
import { LayoutEnvironment } from "../context/layout-environment.js";
import type { LayoutStrategy, LayoutContext } from "./strategy.js";
import { Position } from "../../css/enums.js";
import { containingBlock } from "../utils/node-math.js";

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
      this.layoutAbsoluteOrFixed(node, context);
    }
  }

  private layoutAbsoluteOrFixed(node: LayoutNode, context: LayoutContext): void {
    const cb = containingBlock(node, context.env.viewport);
    node.box.x = cb.x;
    node.box.y = cb.y;
    node.box.contentWidth = cb.width;
    node.box.contentHeight = cb.height;
  }
}
