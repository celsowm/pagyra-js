// src/units/page-utils.ts

import { ptToPx } from "./units.js";

export interface PageMarginsPx {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_PAGE_SIZE_PT = { width: 595.28, height: 841.89 };
export const DEFAULT_PAGE_MARGINS_PT = { top: 36, right: 36, bottom: 36, left: 36 };

export const DEFAULT_PAGE_WIDTH_PX = ptToPx(DEFAULT_PAGE_SIZE_PT.width);
export const DEFAULT_PAGE_HEIGHT_PX = ptToPx(DEFAULT_PAGE_SIZE_PT.height);

export const DEFAULT_PAGE_MARGINS_PX = {
  top: ptToPx(DEFAULT_PAGE_MARGINS_PT.top),
  right: ptToPx(DEFAULT_PAGE_MARGINS_PT.right),
  bottom: ptToPx(DEFAULT_PAGE_MARGINS_PT.bottom),
  left: ptToPx(DEFAULT_PAGE_MARGINS_PT.left),
};

export function resolvePageMarginsPx(pageWidthPx: number, pageHeightPx: number): PageMarginsPx {
  // ... (implementation from html-to-pdf.ts)
  const margins = { ...DEFAULT_PAGE_MARGINS_PX };
  const horizontalSum = margins.left + margins.right;
  const verticalSum = margins.top + margins.bottom;
  const usableWidth = maxContentDimension(pageWidthPx, 0);
  const usableHeight = maxContentDimension(pageHeightPx, 0);

  if (horizontalSum > usableWidth) {
    const scale = usableWidth / (horizontalSum || 1);
    margins.left *= scale;
    margins.right *= scale;
  }
  if (verticalSum > usableHeight) {
    const scale = usableHeight / (verticalSum || 1);
    margins.top *= scale;
    margins.bottom *= scale;
  }
  return margins;
}

export function sanitizeDimension(value: number | undefined, fallback: number): number {
  // ... (implementation from html-to-pdf.ts)
  if (!Number.isFinite(value ?? NaN)) {
    return fallback;
  }
  const sanitized = Number(value);
  return sanitized > 0 ? sanitized : fallback;
}

export function maxContentDimension(total: number, marginsSum: number): number {
  // ... (implementation from html-to-pdf.ts)
  return Math.max(1, total - marginsSum);
}
