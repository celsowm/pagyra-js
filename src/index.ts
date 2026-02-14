export * from "./core.js";
export * from "./html-to-pdf.js";
export * from "./svg/index.js";
export * from "./types/fonts.js";

import { LayoutNode } from "./dom/node.js";
import { ComputedStyle } from "./css/style.js";
import { layoutTree } from "./layout/pipeline/layout-tree.js";
import type { Viewport } from "./geometry/box.js";

export function demoLayout(viewport: Viewport = { width: 800, height: 600 }): LayoutNode {
  const root = new LayoutNode(new ComputedStyle());
  const paragraph = new LayoutNode(
    new ComputedStyle({
      marginTop: 16,
      marginBottom: 16,
    }),
  );
  root.appendChild(paragraph);

  layoutTree(root, viewport);
  return root;
}


// Note: isMain block removed as it relied on node:url and process.argv,
// which breaks browser compatibility. For CLI usage, use a separate entrypoint.
