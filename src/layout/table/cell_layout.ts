import { LayoutNode } from "../../dom/node.js";
import { resolvedLineHeight } from "../../css/style.js";
import { breakTextIntoLines } from "../../text/line-breaker.js";

export function layoutTableCell(td: LayoutNode): void {
  const availableWidth = Math.max(0, td.box.contentWidth);

  td.walk((node) => {
    // Replaced elements (img, svg) have intrinsic dimensions set during DOM conversion.
    // ImageLayoutStrategy.layout() is never called for table cell children, so we derive
    // box dimensions directly from the intrinsic size, scaling down if wider than the cell.
    if (node.intrinsicBlockSize !== undefined && node.intrinsicInlineSize !== undefined) {
      const iw = node.intrinsicInlineSize;
      const ih = node.intrinsicBlockSize;
      const w = availableWidth > 0 && iw > availableWidth ? availableWidth : iw;
      const scale = iw > 0 ? w / iw : 1;
      node.box.contentWidth = w;
      node.box.contentHeight = Math.max(1, Math.round(ih * scale));
      node.box.borderBoxWidth = node.box.contentWidth;
      node.box.borderBoxHeight = node.box.contentHeight;
      return;
    }

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
