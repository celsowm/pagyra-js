import { LayoutNode } from "../../dom/node.js";
import { resolvedLineHeight } from "../../css/style.js";
import { breakTextIntoLines } from "../../text/line-breaker.js";

export function layoutTableCell(td: LayoutNode): void {
  const availableWidth = Math.max(0, td.box.contentWidth);

  td.walk((node) => {
    if (!node.textContent) {
      return;
    }

    const lines = breakTextIntoLines(node.textContent, node.style, availableWidth);
    node.lineBoxes = lines;

    const lineHeight = resolvedLineHeight(node.style);
    const hasRenderableText = node.textContent.trim().length > 0;
    const totalHeight = lines.length > 0 ? lines.length * lineHeight : (hasRenderableText ? lineHeight : 0);
    node.box.contentHeight = totalHeight;

    if (lines.length > 0) {
      const maxWidth = Math.max(...lines.map((line) => line.width));
      node.box.contentWidth = Math.min(availableWidth, maxWidth);
    } else {
      node.box.contentWidth = 0;
    }
  });

  const childHeights = Array.from(td.children).map((child) => child.box.contentHeight ?? 0);
  td.box.contentHeight = Math.max(td.box.contentHeight ?? 0, ...childHeights);
}
