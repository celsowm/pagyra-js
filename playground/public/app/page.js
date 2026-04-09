import {
  CONTENT_DEFAULTS,
  DEFAULT_PAGE_HEIGHT_PX,
  DEFAULT_PAGE_MARGINS_PX,
  DEFAULT_PAGE_WIDTH_PX,
  PAGE_MARGINS,
} from "./constants.js";

export function sanitizeDimension(value, fallback) {
  if (!Number.isFinite(value ?? NaN)) {
    return fallback;
  }
  const sanitized = Number(value);
  return sanitized > 0 ? sanitized : fallback;
}

export function maxContentDimension(total, marginsSum) {
  return Math.max(1, total - marginsSum);
}

export function resolvePageMarginsPx(pageWidthPx, pageHeightPx) {
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

export function getViewportDimensions(dom) {
  const width = Number.parseFloat(dom.viewportWidth.value) || CONTENT_DEFAULTS.widthPx;
  const height = Number.parseFloat(dom.viewportHeight.value) || CONTENT_DEFAULTS.heightPx;
  return {
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  };
}

export function computePageSize(viewport) {
  return {
    width: viewport.width + PAGE_MARGINS.left + PAGE_MARGINS.right,
    height: viewport.height + PAGE_MARGINS.top + PAGE_MARGINS.bottom,
  };
}

export function setViewportDefaults(dom) {
  dom.viewportWidth.value = Math.round(CONTENT_DEFAULTS.widthPx).toString();
  dom.viewportHeight.value = Math.round(CONTENT_DEFAULTS.heightPx).toString();
}

export function getSanitizedPageMetrics(viewport) {
  const page = computePageSize(viewport);
  const pageWidth = sanitizeDimension(page.width, DEFAULT_PAGE_WIDTH_PX);
  const pageHeight = sanitizeDimension(page.height, DEFAULT_PAGE_HEIGHT_PX);
  const margins = resolvePageMarginsPx(pageWidth, pageHeight);
  const maxContentWidth = maxContentDimension(pageWidth, margins.left + margins.right);
  const maxContentHeight = maxContentDimension(pageHeight, margins.top + margins.bottom);
  const viewportWidth = Math.min(sanitizeDimension(viewport.width, maxContentWidth), maxContentWidth);
  const viewportHeight = Math.min(sanitizeDimension(viewport.height, maxContentHeight), maxContentHeight);

  return {
    page,
    pageWidth,
    pageHeight,
    margins,
    maxContentWidth,
    maxContentHeight,
    viewportWidth,
    viewportHeight,
  };
}
