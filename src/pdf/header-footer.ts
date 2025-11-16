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

export { paintHeaderFooter } from "./header-footer-painter.js";
