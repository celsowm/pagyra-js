import type { TextPaintOptions } from "./types.js";
import type { PagePainter } from "./page-painter.js";
import type { HeaderFooterVariant } from "./header-footer-layout.js";
import { applyPlaceholders } from "./header-footer-tokens.js";

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
