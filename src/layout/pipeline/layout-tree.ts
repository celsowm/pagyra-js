import { LayoutNode } from "../../dom/node.js";
import type { Viewport } from "../../geometry/box.js";
import { createDefaultLayoutEngine } from "./default-engine.js";

export function layoutTree(root: LayoutNode, viewport: Viewport): LayoutNode {
  const engine = createDefaultLayoutEngine();
  return engine.layoutTree(root, viewport);
}
