import type { Simple, AttrCond, Pseudo, Combinator } from "./types.js";
import { parseSelector } from "./parser.js";
import { simpleKey } from "./simple-key.js";

export interface DomLikeElement {
  readonly tagName: string;
  readonly id?: string;
  readonly classList?: DOMTokenList;
  readonly parentElement: DomLikeElement | Element | null;
  readonly firstElementChild: DomLikeElement | Element | null;
  readonly lastElementChild: DomLikeElement | Element | null;
  readonly nextElementSibling: DomLikeElement | Element | null;
  readonly previousElementSibling: DomLikeElement | Element | null;
  readonly ownerDocument?: { documentElement?: DomLikeElement | Element };
  readonly textContent?: string | null;
  getAttribute(name: string): string | null;
  hasAttribute?(name: string): boolean;
  querySelectorAll?(selectors: string): DomLikeElement[] | NodeListOf<Element>;
}

/** Creates a right-to-left matcher for the supported CSS selector subset. */
export function createSelectorMatcher(selector: string): ((el: DomLikeElement) => boolean) | null {
  const chain = parseSelector(selector);
  if (!chain) {
    return null;
  }

  type MatchCache = WeakMap<DomLikeElement, Map<string, boolean>>;
  const cache: MatchCache = new WeakMap();

  function memo(
    element: DomLikeElement,
    simple: Simple,
    rawMatcher: (candidate: DomLikeElement, selectorPart: Simple) => boolean,
  ): boolean {
    let elementCache = cache.get(element);
    if (!elementCache) {
      elementCache = new Map();
      cache.set(element, elementCache);
    }
    const key = simpleKey(simple);
    const cached = elementCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const result = rawMatcher(element, simple);
    elementCache.set(key, result);
    return result;
  }

  function matchAttribute(element: DomLikeElement, condition: AttrCond): boolean {
    const value = element.getAttribute(condition.name);
    if (condition.op === "exists") {
      return value !== null;
    }
    if (value === null) {
      return false;
    }
    switch (condition.op) {
      case "=":
        return value === condition.value;
      case "~=":
        return value.split(/\s+/).includes(condition.value!);
      case "|=":
        return value === condition.value || value.startsWith(`${condition.value}-`);
      case "^=":
        return value.startsWith(condition.value!);
      case "$=":
        return value.endsWith(condition.value!);
      case "*=":
        return value.includes(condition.value!);
      default:
        return false;
    }
  }

  function indexInParent(element: DomLikeElement): number {
    const parent = element.parentElement;
    if (!parent) {
      return -1;
    }
    let index = 0;
    for (
      let sibling = parent.firstElementChild as DomLikeElement | null;
      sibling;
      sibling = sibling.nextElementSibling as DomLikeElement | null
    ) {
      index++;
      if (sibling === element) {
        return index;
      }
    }
    return -1;
  }

  function indexOfType(element: DomLikeElement): number {
    const parent = element.parentElement;
    if (!parent) {
      return -1;
    }
    const tagName = element.tagName.toLowerCase();
    let index = 0;
    for (
      let sibling = parent.firstElementChild as DomLikeElement | null;
      sibling;
      sibling = sibling.nextElementSibling as DomLikeElement | null
    ) {
      if (sibling.tagName.toLowerCase() === tagName) {
        index++;
        if (sibling === element) {
          return index;
        }
      }
    }
    return -1;
  }

  function firstElementOfType(element: DomLikeElement): DomLikeElement | null {
    const parent = element.parentElement;
    if (!parent) {
      return null;
    }
    const tagName = element.tagName.toLowerCase();
    for (
      let sibling = parent.firstElementChild as DomLikeElement | null;
      sibling;
      sibling = sibling.nextElementSibling as DomLikeElement | null
    ) {
      if (sibling.tagName.toLowerCase() === tagName) {
        return sibling;
      }
    }
    return null;
  }

  function lastElementOfType(element: DomLikeElement): DomLikeElement | null {
    const parent = element.parentElement;
    if (!parent) {
      return null;
    }
    const tagName = element.tagName.toLowerCase();
    for (
      let sibling = parent.lastElementChild as DomLikeElement | null;
      sibling;
      sibling = sibling.previousElementSibling as DomLikeElement | null
    ) {
      if (sibling.tagName.toLowerCase() === tagName) {
        return sibling;
      }
    }
    return null;
  }

  function matchesNth(index: number, a: number, b: number): boolean {
    if (index < 1) {
      return false;
    }
    if (a === 0) {
      return index === b;
    }
    return (index - b) % a === 0 && (index - b) / a >= 0;
  }

  function matchesPseudo(element: DomLikeElement, pseudo: Pseudo): boolean {
    switch (pseudo.kind) {
      case "first-child":
        return indexInParent(element) === 1;
      case "last-child":
        return element.parentElement?.lastElementChild === element;
      case "only-child":
        return element.parentElement?.firstElementChild === element
          && element.parentElement?.lastElementChild === element;
      case "nth-child":
        return matchesNth(indexInParent(element), pseudo.a, pseudo.b);
      case "first-of-type":
        return firstElementOfType(element) === element;
      case "last-of-type":
        return lastElementOfType(element) === element;
      case "only-of-type":
        return firstElementOfType(element) === element && lastElementOfType(element) === element;
      case "nth-of-type":
        return matchesNth(indexOfType(element), pseudo.a, pseudo.b);
      case "empty":
        return element.firstElementChild === null && (element.textContent ?? "").length === 0;
      case "not":
        return !pseudo.selectors.some((selectorOption) => matchesSimple(element, selectorOption));
      case "is":
      case "where":
        return pseudo.selectors.some((selectorOption) => matchesSimple(element, selectorOption));
      case "root":
        return element.ownerDocument?.documentElement === element;
    }
  }

  function matchesSimple(element: DomLikeElement, simple: Simple): boolean {
    if (simple.tag && element.tagName.toLowerCase() !== simple.tag) {
      return false;
    }
    if (simple.id && element.id !== simple.id) {
      return false;
    }
    for (const className of simple.classes) {
      if (!element.classList?.contains?.(className)) {
        return false;
      }
    }
    for (const attribute of simple.attrs) {
      if (!matchAttribute(element, attribute)) {
        return false;
      }
    }
    for (const pseudo of simple.pseudos) {
      if (!matchesPseudo(element, pseudo)) {
        return false;
      }
    }
    return true;
  }

  return function match(element: DomLikeElement): boolean {
    let current: DomLikeElement | null = element;
    let index = chain.length - 1;

    if (!memo(current, chain[index].simple, matchesSimple)) {
      return false;
    }
    index--;

    while (index >= 0) {
      const needed = chain[index];
      const combinator = chain[index + 1].combinatorToLeft as Combinator | undefined;

      if (combinator === ">") {
        current = current.parentElement as DomLikeElement | null;
        if (!current || !memo(current, needed.simple, matchesSimple)) {
          return false;
        }
        index--;
        continue;
      }

      if (combinator === " ") {
        let ancestor = current.parentElement as DomLikeElement | null;
        let found = false;
        while (ancestor) {
          if (memo(ancestor, needed.simple, matchesSimple)) {
            current = ancestor;
            found = true;
            break;
          }
          ancestor = ancestor.parentElement as DomLikeElement | null;
        }
        if (!found) {
          return false;
        }
        index--;
        continue;
      }

      if (combinator === "+") {
        const sibling = current.previousElementSibling as DomLikeElement | null;
        if (!sibling || !memo(sibling, needed.simple, matchesSimple)) {
          return false;
        }
        current = sibling;
        index--;
        continue;
      }

      if (combinator === "~") {
        let sibling = current.previousElementSibling as DomLikeElement | null;
        let found = false;
        while (sibling) {
          if (memo(sibling, needed.simple, matchesSimple)) {
            current = sibling;
            found = true;
            break;
          }
          sibling = sibling.previousElementSibling as DomLikeElement | null;
        }
        if (!found) {
          return false;
        }
        index--;
        continue;
      }

      if (!memo(current, needed.simple, matchesSimple)) {
        return false;
      }
      index--;
    }
    return true;
  };
}
