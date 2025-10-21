import type { HeaderFooterHTML, LayerMode, PageSize, Rect, TextPaintOptions } from "./types.js";
import type { PagePainter } from "./page-painter.js";

export interface HeaderFooterContext {
  readonly hf: HeaderFooterHTML;
  readonly pageSize: PageSize;
  readonly baseBox: Rect;
}

export interface HeaderFooterLayout {
  readonly headerHeightPt: number;
  readonly footerHeightPt: number;
  readonly headerHeightPx: number;
  readonly footerHeightPx: number;
  readonly layerMode: LayerMode;
  readonly header: HeaderFooterVariants;
  readonly footer: HeaderFooterVariants;
  readonly clipOverflow: boolean;
}

export interface HeaderFooterVariants {
  readonly defaultVariant?: HeaderFooterVariant;
  readonly firstVariant?: HeaderFooterVariant;
  readonly evenVariant?: HeaderFooterVariant;
  readonly oddVariant?: HeaderFooterVariant;
}

export interface HeaderFooterVariant {
  readonly content: unknown;
  readonly maxHeightPt: number;
  readonly maxHeightPx: number;
}

export interface PlaceholderTokens {
  readonly resolved: Map<string, string>;
  resolve(pageIndex: number): string;
}

export function initHeaderFooterContext(hf: HeaderFooterHTML, pageSize: PageSize, basePageBox: Rect): HeaderFooterContext {
  return { hf, pageSize, baseBox: basePageBox };
}

export function layoutHeaderFooterTrees(ctx: HeaderFooterContext, pxToPt: (px: number) => number): HeaderFooterLayout {
  const headerVariants = prepareVariants(ctx.hf, pxToPt, "header");
  const footerVariants = prepareVariants(ctx.hf, pxToPt, "footer");
  const headerHeightPt = resolveVariantHeight(headerVariants);
  const footerHeightPt = resolveVariantHeight(footerVariants);
  const headerHeightPx = resolveVariantHeightPx(headerVariants);
  const footerHeightPx = resolveVariantHeightPx(footerVariants);

  return {
    headerHeightPt,
    footerHeightPt,
    headerHeightPx,
    footerHeightPx,
    layerMode: ctx.hf.layerMode,
    header: headerVariants,
    footer: footerVariants,
    clipOverflow: ctx.hf.clipOverflow,
  };
}

export function adjustPageBoxForHf(baseBox: Rect, layout: HeaderFooterLayout): Rect {
  return {
    x: baseBox.x,
    y: baseBox.y + layout.headerHeightPx,
    width: baseBox.width,
    height: Math.max(0, baseBox.height - layout.headerHeightPx - layout.footerHeightPx),
  };
}

export function computeHfTokens(
  placeholders: HeaderFooterHTML["placeholders"],
  totalPages: number,
  meta: { title?: string } = {},
): Map<string, string | ((page: number, total: number) => string)> {
  const tokens = new Map<string, string | ((page: number, total: number) => string)>();
  for (const [key, value] of Object.entries(placeholders ?? {})) {
    tokens.set(key, value);
  }
  tokens.set("page", (page, _total) => String(page));
  tokens.set("pages", (_page, total) => String(total));
  if (!tokens.has("title") && meta.title) {
    tokens.set("title", meta.title);
  }
  tokens.set("date", () => new Date().toLocaleDateString());
  return tokens;
}

export function pickHeaderVariant(
  layout: HeaderFooterLayout,
  pageIndex: number,
  totalPages: number,
): HeaderFooterVariant | undefined {
  return pickVariant(layout.header, pageIndex, totalPages);
}

export function pickFooterVariant(
  layout: HeaderFooterLayout,
  pageIndex: number,
  totalPages: number,
): HeaderFooterVariant | undefined {
  return pickVariant(layout.footer, pageIndex, totalPages);
}

export function applyPlaceholders(
  template: string,
  tokens: Map<string, string | ((page: number, total: number) => string)>,
  pageIndex: number,
  totalPages: number,
): string {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const entry = tokens.get(key);
    if (entry === undefined) {
      return "";
    }
    if (typeof entry === "string") {
      return entry;
    }
    return entry(pageIndex, totalPages);
  });
}

export function paintHeaderFooter(
  painter: PagePainter,
  header: HeaderFooterVariant | undefined,
  footer: HeaderFooterVariant | undefined,
  tokens: Map<string, string | ((page: number, total: number) => string)>,
  pageIndex: number,
  totalPages: number,
  baseOptions: TextPaintOptions = { fontSizePt: 10 },
  under = false,
): void {
  // Currently the rendering does not differentiate between under/over layers,
  // but the parameter is accepted to stay close to the reference pipeline.
  void under;
  const headerText = header?.content ? stringify(header.content) : undefined;
  const footerText = footer?.content ? stringify(footer.content) : undefined;

  if (headerText) {
    const rendered = applyPlaceholders(headerText, tokens, pageIndex, totalPages);
    painter.drawText(rendered, 16, header?.maxHeightPx ?? 24, { ...baseOptions, absolute: true });
  }

  if (footerText) {
    const rendered = applyPlaceholders(footerText, tokens, pageIndex, totalPages);
    const yPx = painter.pageHeightPx ? painter.pageHeightPx - ((footer?.maxHeightPx ?? 24) + 16) : 16;
    painter.drawText(rendered, 16, yPx, { ...baseOptions, absolute: true });
  }
}

function prepareVariants(
  hf: HeaderFooterHTML,
  pxToPt: (value: number) => number,
  position: "header" | "footer",
): HeaderFooterVariants {
  const maxHeightPx = position === "header" ? hf.maxHeaderHeightPx ?? 0 : hf.maxFooterHeightPx ?? 0;
  const createVariant = (content: unknown | undefined): HeaderFooterVariant | undefined => {
    if (!content) {
      return undefined;
    }
    return {
      content,
      maxHeightPt: pxToPt(maxHeightPx),
      maxHeightPx,
    };
  };

  if (position === "header") {
    return {
      defaultVariant: createVariant(hf.headerHtml),
      firstVariant: createVariant(hf.headerFirstHtml),
      evenVariant: createVariant(hf.headerEvenHtml),
      oddVariant: createVariant(hf.headerOddHtml),
    };
  }

  return {
    defaultVariant: createVariant(hf.footerHtml),
    firstVariant: createVariant(hf.footerFirstHtml),
    evenVariant: createVariant(hf.footerEvenHtml),
    oddVariant: createVariant(hf.footerOddHtml),
  };
}

function resolveVariantHeight(variants: HeaderFooterVariants): number {
  const heights = [
    variants.defaultVariant?.maxHeightPt ?? 0,
    variants.firstVariant?.maxHeightPt ?? 0,
    variants.evenVariant?.maxHeightPt ?? 0,
    variants.oddVariant?.maxHeightPt ?? 0,
  ];
  return Math.max(...heights);
}

function resolveVariantHeightPx(variants: HeaderFooterVariants): number {
  const heights = [
    variants.defaultVariant?.maxHeightPx ?? 0,
    variants.firstVariant?.maxHeightPx ?? 0,
    variants.evenVariant?.maxHeightPx ?? 0,
    variants.oddVariant?.maxHeightPx ?? 0,
  ];
  return Math.max(...heights);
}

function pickVariant(
  variants: HeaderFooterVariants,
  pageIndex: number,
  totalPages: number,
): HeaderFooterVariant | undefined {
  if (pageIndex === 1 && variants.firstVariant) {
    return variants.firstVariant;
  }
  if (totalPages > 1) {
    if (pageIndex % 2 === 0 && variants.evenVariant) {
      return variants.evenVariant;
    }
    if (pageIndex % 2 === 1 && variants.oddVariant) {
      return variants.oddVariant;
    }
  }
  return variants.defaultVariant;
}

function stringify(content: unknown): string {
  if (content == null) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (typeof content === "function") {
    return String(content());
  }
  return JSON.stringify(content);
}
