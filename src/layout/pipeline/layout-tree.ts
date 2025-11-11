import { LayoutNode } from "../../dom/node.js";
import type { Viewport } from "../../geometry/box.js";
import { createDefaultLayoutEngine } from "./default-engine.js";
import type { FontEmbedder } from "../../pdf/font/embedder.js";

export function layoutTree(
  root: LayoutNode,
  viewport: Viewport,
  fontEmbedder: FontEmbedder | null = null
): LayoutNode {
  const engine = createDefaultLayoutEngine();
  return engine.layoutTree(root, viewport, fontEmbedder);
}
