export const PAGE_DEFAULTS = {
  pxPerPt: 96 / 72,
  widthPt: 595.28,
  heightPt: 841.89,
  marginPt: 36,
};

export const PAGE_DIMENSIONS = {
  widthPx: PAGE_DEFAULTS.widthPt * PAGE_DEFAULTS.pxPerPt,
  heightPx: PAGE_DEFAULTS.heightPt * PAGE_DEFAULTS.pxPerPt,
  marginPx: PAGE_DEFAULTS.marginPt * PAGE_DEFAULTS.pxPerPt,
};

export const PAGE_MARGINS = {
  top: PAGE_DIMENSIONS.marginPx,
  right: PAGE_DIMENSIONS.marginPx,
  bottom: PAGE_DIMENSIONS.marginPx,
  left: PAGE_DIMENSIONS.marginPx,
};

export const CONTENT_DEFAULTS = {
  widthPx: PAGE_DIMENSIONS.widthPx - PAGE_DIMENSIONS.marginPx * 2,
  heightPx: PAGE_DIMENSIONS.heightPx - PAGE_DIMENSIONS.marginPx * 2,
};

export const DEFAULT_PAGE_MARGINS_PX = {
  top: PAGE_MARGINS.top,
  right: PAGE_MARGINS.right,
  bottom: PAGE_MARGINS.bottom,
  left: PAGE_MARGINS.left,
};

export const DEFAULT_PAGE_WIDTH_PX = PAGE_DIMENSIONS.widthPx;
export const DEFAULT_PAGE_HEIGHT_PX = PAGE_DIMENSIONS.heightPx;
export const DEFAULT_HEADER_FOOTER_MAX_HEIGHT_PX = 64;
export const PAGED_BODY_MARGIN_MODE = "zero";
export const PLAYGROUND_MODE = (window.__PLAYGROUND_MODE ?? "node").toLowerCase();
export const IS_BROWSER_MODE = PLAYGROUND_MODE === "browser";
export const DEFAULT_RENDER_LABEL = "Convert to PDF";
export const DEFAULT_RENDER_SUBTLE = "Generate a fresh document";

export const STATUS_COLORS = {
  neutral: "#8da1c4",
  success: "#4ecdc4",
  error: "#ff8a7a",
};

export const CODEMIRROR_BASE_OPTIONS = {
  theme: "darcula",
  lineNumbers: true,
  lineWrapping: true,
  tabSize: 2,
  indentUnit: 2,
  indentWithTabs: false,
};
