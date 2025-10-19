import { ensureId, DomIds } from "./ids.js";
import type { UID } from "./ids.js";
import { log } from "./log.js";

export interface TreeMeta {
  id: UID; depth: number; parentId?: UID;
  prevSiblingId?: UID; nextSiblingId?: UID;
  siblingIndex: number; siblingCount: number;
  path: string;
}

export function analyzeDomNode(node: Node, parent?: Node, depth = 0): TreeMeta {
  const id = ensureId(DomIds, node);
  const parentId = parent ? ensureId(DomIds, parent) : undefined;

  const siblings = parent ? Array.from((parent as Element).childNodes) : [node];
  const idx = siblings.indexOf(node);
  const siblingCount = siblings.length;
  const prev = idx > 0 ? siblings[idx - 1] : undefined;
  const next = idx >= 0 && idx < siblingCount - 1 ? siblings[idx + 1] : undefined;
  const prevSiblingId = prev ? ensureId(DomIds, prev) : undefined;
  const nextSiblingId = next ? ensureId(DomIds, next) : undefined;

  const path = computeDomPath(node as Element);
  const meta: TreeMeta = { id, depth, parentId, prevSiblingId, nextSiblingId, siblingIndex: idx, siblingCount, path };

  log("PARSE","TRACE","DOM node", {
    ...meta,
    tag: (node as Element).nodeType === 1 ? (node as Element).tagName.toLowerCase() : "#text",
    textPreview: node.nodeType === 3 ? (node.textContent ?? "").slice(0,60) : undefined
  });
  return meta;
}

export function computeDomPath(el: Element): string {
  if (!el || el.nodeType !== 1) return "#text";
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1) {
    const current: Element = cur;
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    let nth = 1;
    if (parent) {
      const siblings = Array.from(parent.children) as Element[];
      const sameTagSiblings = siblings.filter((candidate) => candidate.tagName === current.tagName);
      if (sameTagSiblings.length > 1) {
        nth = sameTagSiblings.indexOf(current) + 1;
      }
    }
    const id = current.id ? `#${current.id}` : "";
    const cls = current.classList?.length ? "." + Array.from(current.classList).join(".") : "";
    parts.unshift(`${tag}${id}${cls}${parent && nth>1 ? `:nth-of-type(${nth})` : ""}`);
    cur = parent;
  }
  return parts.join(">");
}
