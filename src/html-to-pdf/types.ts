import type { FontConfig } from "../types/fonts.js";
import type { LogLevel } from "../logging/debug.js";
import { LayoutNode } from "../dom/node.js";
import { buildRenderTree } from "../pdf/layout-tree-builder.js";
import type { PageMarginsPx } from "../units/page-utils.js";
import type { HeaderFooterHTML } from "../pdf/types.js";
import type { Environment } from "../environment/environment.js";

export interface RenderHtmlOptions {
  html: string;
  css?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  pageWidth?: number;
  pageHeight?: number;
  margins?: Partial<PageMarginsPx>;
  debug?: boolean;
  debugLevel?: LogLevel;
  debugCats?: string[];
  fontConfig?: FontConfig;
  resourceBaseDir?: string;
  assetRootDir?: string;
  headerFooter?: Partial<HeaderFooterHTML>;
  /** Environment abstraction (Node/browser). Defaults to Node implementation. */
  environment?: Environment;
}

export interface PreparedRender {
  layoutRoot: LayoutNode;
  renderTree: ReturnType<typeof buildRenderTree>;
  pageSize: { widthPt: number; heightPt: number };
  margins: PageMarginsPx;
}

