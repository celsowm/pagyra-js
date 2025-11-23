import type { LayoutNode } from "../../dom/node.js";
import type { LayoutEnvironment } from "../context/layout-environment.js";
import type { LayoutContext } from "./strategy.js";

export interface LayoutContextFactory {
  create(env: LayoutEnvironment, dispatcher: (node: LayoutNode) => void): LayoutContext;
}

export class DefaultLayoutContextFactory implements LayoutContextFactory {
  create(env: LayoutEnvironment, dispatcher: (node: LayoutNode) => void): LayoutContext {
    return {
      env,
      layoutChild: dispatcher,
    };
  }
}
