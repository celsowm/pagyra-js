import { buildLineBoxes } from '../inline/line_breaker.js';
import { LayoutNode } from '../../dom/node.js';

import { estimateLineWidth } from '../../layout/utils/text-metrics.js';
import { ComputedStyle, resolvedLineHeight } from '../../css/style.js';
import { WhiteSpace } from '../../css/enums.js';

const measureText = (
  text: string,
  fontFamily: string,
  fontSizePx: number,
  fontWeight?: number,
  fontStyle?: string
) => {
  const style = new ComputedStyle({
    fontFamily,
    fontSize: fontSizePx,
    fontWeight,
    lineHeight: fontSizePx * 1.2
  });
  const width = estimateLineWidth(text, style);
  return {
    width,
    ascent: fontSizePx * 0.8, // Approximate
    descent: fontSizePx * 0.2, // Approximate
    lineHeight: resolvedLineHeight(style)
  };
};

export function layoutTableCell(td: LayoutNode) {
  // 1) Make sure td.box.contentWidth is resolved (from column widths):
  //    usedContentWidth = usedColumnWidth - paddingX - borderX
  const avail = Math.max(0, td.box.contentWidth);

  // 2) Inline layout for descendant TextNodes based on that width
  td.walk((node) => {
    if (node.textContent) {
      const t = node;

      const computedStyle: any = {
        fontFamily: t.style.fontFamily || 'sans-serif',
        fontSizePx: t.style.fontSize,
        fontWeight: t.style.fontWeight,
        fontStyle: undefined,
        lineHeightPx: resolvedLineHeight(t.style),
        whiteSpace: 'normal',
        overflowWrap: 'normal',
        wordBreak: 'normal'
      };

      t.lineBoxes = buildLineBoxes(
        t.textContent || '',
        computedStyle,
        avail,
        measureText
      );

      // optional: size the text node's box
      const totalH = (t.lineBoxes || []).reduce((acc: number, l: any) => acc + l.height, 0);
      t.box.contentHeight = totalH;
      // t.box.contentWidth = Math.min(avail, Math.max(0, ...(t.lineBoxes || []).map(l => l.width)));
    }
  });

  // 3) Finish td height from children as you already do
  const childHeights = Array.from(td.children).map((child: LayoutNode) => child.box.contentHeight || 0);
  td.box.contentHeight = Math.max(td.box.contentHeight || 0, ...childHeights);
}

// Add logging for sanity audit
export function auditTableCell(td: LayoutNode) {
  console.log('[AUDIT] td inline', {
    tdWidth: td.box.contentWidth,
    lines: (td.lineBoxes || []).length,
    joined: (td.lineBoxes || []).map((l: any) => l.text).join(' ⏎ ')
  });
}

// For the problematic cell, add specific logging before calling layoutTableCell
export function debugTableCell(cell: LayoutNode) {
  if (cell.tagName === 'td' && cell.textContent?.includes('Row 3, Cell 3')) {
    console.log('[DEBUG] before inline layout for problematic td', {
      textContent: cell.textContent,
      contentWidth: cell.box.contentWidth
    });
  }
}
