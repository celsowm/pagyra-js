import { LayoutNode } from "../../dom/node.js";
import { LayoutEnvironment } from "../context/layout-environment.js";

export interface LayoutContext {
  readonly env: LayoutEnvironment;
  layoutChild(node: LayoutNode): void;
}

export interface LayoutStrategy {
  canLayout(node: LayoutNode): boolean;
  layout(node: LayoutNode, context: LayoutContext): void;
}
