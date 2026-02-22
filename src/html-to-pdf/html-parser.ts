import { parseHTML } from "linkedom";

export function normalizeHtmlInput(html: string): string {
  const hasHtmlTag = /<\s*html[\s>]/i.test(html);
  if (hasHtmlTag) {
    return html;
  }
  return wrapHtml(html);
}

export function wrapHtml(html: string): string {
  return `<!doctype html><html><head></head><body>${html}</body></html>`;
}

export function parseDocument(html: string): Document | undefined {
  const parsed = parseHTML(html) as unknown;
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }
  if (isDocumentLike(parsed)) {
    return parsed;
  }
  let maybeDocument: unknown;
  try {
    maybeDocument = (parsed as { document?: unknown }).document;
  } catch {
    maybeDocument = undefined;
  }
  if (isDocumentLike(maybeDocument)) {
    return maybeDocument;
  }
  return undefined;
}

export function needsReparse(document: Document | undefined): boolean {
  if (!document) return true;
  let docEl: string | undefined;
  try {
    docEl = document.documentElement?.tagName;
  } catch {
    return true;
  }
  const docIsHtml = docEl?.toUpperCase() === "HTML";
  if (!docIsHtml) return true;
  try {
    if (!document.body) return true;
  } catch {
    return true;
  }
  return false;
}

export function selectContentRoot(document: Document): Element | null {
  const rootElement = document.body;
  let processChildrenOf: Element | null = rootElement;

  if (rootElement && rootElement.childNodes.length === 0) {
    const meaningfulChildren = Array.from(document.documentElement.childNodes).filter((node) => {
      return node.nodeType === node.ELEMENT_NODE && (node as HTMLElement).tagName !== "HEAD";
    });
    if (meaningfulChildren.length > 0) {
      processChildrenOf = document.documentElement;
    }
  } else if (!rootElement) {
    processChildrenOf = document.documentElement;
  }

  return processChildrenOf;
}

export function shouldSkipContentNode(node: ChildNode): boolean {
  if (node.nodeType !== node.ELEMENT_NODE) {
    return false;
  }
  const tagName = (node as HTMLElement).tagName.toLowerCase();
  return tagName === "head" || tagName === "meta" || tagName === "title" || tagName === "link" || tagName === "script";
}

function isDocumentLike(value: unknown): value is Document {
  if (!value || typeof value !== "object") return false;
  return "querySelectorAll" in value && "childNodes" in value;
}

