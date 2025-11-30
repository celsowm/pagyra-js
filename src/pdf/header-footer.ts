export {
  type HeaderFooterContext,
  type HeaderFooterLayout,
  type HeaderFooterVariant,
  type HeaderFooterVariants,
  initHeaderFooterContext,
  layoutHeaderFooterTrees,
  adjustPageBoxForHf,
  pickHeaderVariant,
  pickFooterVariant,
} from "./header-footer-layout.js";

export { computeHfTokens, applyPlaceholders } from "./header-footer-tokens.js";

export { paintHeaderFooter, type HeaderFooterPaintContext } from "./header-footer-painter.js";

export {
  renderHeaderFooterHtml,
  paintRenderedHeaderFooter,
  calculatePageContentArea,
  type HeaderFooterRenderOptions,
  type RenderedHeaderFooter,
  type PageContentAreaConfig,
} from "./header-footer-renderer.js";
export type { Environment as HeaderFooterEnvironment } from "../environment/environment.js";
