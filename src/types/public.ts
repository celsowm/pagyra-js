export interface ViewportPx { width: number; height: number; }
export interface PageMarginsPx { top: number; right: number; bottom: number; left: number; }

export interface RenderHtmlOptions {
  html: string;
  css?: string;
  viewport: ViewportPx;
  page: { widthPx: number; heightPx: number; marginsPx: PageMarginsPx };
  debug?: { level?: 'trace'|'debug'|'info'|'warn'|'error'; cats?: string[] };
  fontConfig?: unknown;           // keep your current type if you have one
  resourceBaseDir?: string;
  assetRootDir?: string;
}

export interface PreparedRender {
  layoutRoot: unknown;            // use your LayoutNode
  renderTree: unknown;            // use your RenderTree
  pageSizePt: { width: number; height: number };
}
