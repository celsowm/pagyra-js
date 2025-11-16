import type { HeaderFooterHTML } from "./types.js";

export function computeHfTokens(
  placeholders: HeaderFooterHTML["placeholders"],
  _totalPages: number,
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
