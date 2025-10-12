import { LayoutNode } from "../../dom/node.js";
import type { LayoutContext } from "../pipeline/strategy.js";

export interface Fragmentainer {
  width: number;
  height: number;
  yStart: number;
  yEnd: number;
}

export interface FragmentResult {
  fragments: LayoutNode[];
}

export function fragmentFlow(_root: LayoutNode, _fragmentainers: Fragmentainer[], _context: LayoutContext): FragmentResult {
  return { fragments: [] };
}
