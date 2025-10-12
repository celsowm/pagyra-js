import { LayoutNode } from "../../dom/node.js";

export function finalizeOverflow(node: LayoutNode): void {
  const contentWidth = node.box.contentWidth;
  const contentHeight = node.box.contentHeight;
  node.box.scrollWidth = Math.max(
    contentWidth,
    ...node.children.map((child) => child.box.x + child.box.borderBoxWidth - node.box.x),
  );
  node.box.scrollHeight = Math.max(
    contentHeight,
    ...node.children.map((child) => child.box.y + child.box.borderBoxHeight - node.box.y),
  );
}
