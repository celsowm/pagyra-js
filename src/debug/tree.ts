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
    const tag = cur.tagName.toLowerCase();
    const parent = cur.parentElement;
    let nth = 1;
    if (parent) {
      const same = Array.from(parent.children).filter(c => c.tagName === cur!.tagName);
      if (same.length > 1) nth = same.indexOf(cur) + 1;
    }
    const id = cur.id ? `#${cur.id}` : "";
    const cls = cur.classList?.length ? "." + Array.from(cur.classList).join(".") : "";
    parts.unshift(`${tag}${id}${cls}${parent && nth>1 ? `:nth-of-type(${nth})` : ""}`);
    cur = parent;
  }
  return parts.join(">");
}
