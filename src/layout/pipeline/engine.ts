import { LayoutNode } from "../../dom/node.js";
import type { Viewport } from "../../geometry/box.js";
import { LayoutEnvironment } from "../context/layout-environment.js";
import type { FontEmbedder } from "../../pdf/font/embedder.js";
import type { LayoutStrategy, LayoutContext } from "./strategy.js";
import type { LayoutContextFactory } from "./context-factory.js";
import { DefaultLayoutContextFactory } from "./context-factory.js";
import type { TextMetricsInitializer } from "./text-metrics-initializer.js";
import { DefaultTextMetricsInitializer } from "./text-metrics-initializer.js";
import type { OutOfFlowManager } from "./out-of-flow-manager.js";
import { DefaultOutOfFlowManager } from "./out-of-flow-manager.js";

export interface LayoutEngineOptions {
  strategies: readonly LayoutStrategy[];
  contextFactory?: LayoutContextFactory;
  textMetricsInitializer?: TextMetricsInitializer;
  outOfFlowManager?: OutOfFlowManager;
}

export class LayoutEngine {
  private readonly strategies: readonly LayoutStrategy[];
  private readonly contextFactory: LayoutContextFactory;
  private readonly textMetricsInitializer: TextMetricsInitializer;
  private readonly outOfFlowManager: OutOfFlowManager;

  constructor(options: LayoutEngineOptions) {
    this.strategies = options.strategies;
    this.contextFactory = options.contextFactory ?? new DefaultLayoutContextFactory();
    this.textMetricsInitializer = options.textMetricsInitializer ?? new DefaultTextMetricsInitializer();
    this.outOfFlowManager = options.outOfFlowManager ?? new DefaultOutOfFlowManager();
  }

  layoutTree(root: LayoutNode, viewport: Viewport, fontEmbedder: FontEmbedder | null): LayoutNode {
    const environment = new LayoutEnvironment({ viewport, fontEmbedder });
    const context: LayoutContext = this.contextFactory.create(environment, (node: LayoutNode) => {
      this.layoutNodeInternal(node, context);
    });

    this.textMetricsInitializer.assign(root, fontEmbedder);

    root.box.x = 0;
    root.box.y = 0;
    root.box.contentWidth = viewport.width;
    root.box.contentHeight = viewport.height;

    this.layoutNodeInternal(root, context);
    this.outOfFlowManager.layoutOutOfFlow(root, context, (node, ctx) => this.layoutNodeInternal(node, ctx));
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
}
