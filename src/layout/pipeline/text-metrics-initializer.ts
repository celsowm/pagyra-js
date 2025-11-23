import type { LayoutNode } from "../../dom/node.js";
import type { FontEmbedder } from "../../pdf/font/embedder.js";
import { assignIntrinsicTextMetrics } from "../utils/text-metrics.js";

export interface TextMetricsInitializer {
  assign(root: LayoutNode, fontEmbedder: FontEmbedder | null): void;
}

export class DefaultTextMetricsInitializer implements TextMetricsInitializer {
  assign(root: LayoutNode, fontEmbedder: FontEmbedder | null): void {
    assignIntrinsicTextMetrics(root, fontEmbedder);
  }
}
