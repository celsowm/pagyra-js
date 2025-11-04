import type { Simple, AttrCond, Pseudo, Combinator } from "./types.js";
import { parseSelector } from "./parser.js";
import { simpleKey } from "./simple-key.js";

/**
 * Cria um predicado (el)=>boolean que testa o seletor.
 * - Avaliação right-to-left
 * - Suporte a combinadores: ', '>', '+', '~'
 * - Suporte a tag/#id/.classe/[attr]/:first/last/nth-child/:not(simple)
 * - Memoização por nó para matches de "Simple"
 */
export function createSelectorMatcher(selector: string): ((el: Element) => boolean) | null {
  const chain = parseSelector(selector);
  if (!chain) return null;

  // Cache: (el) -> (simpleKey -> boolean)
  type MatchCache = WeakMap<Element, Map<string, boolean>>;
  const cache: MatchCache = new WeakMap();

  function memo(el: Element, s: Simple, raw: (e: Element, s: Simple) => boolean): boolean {
    let m = cache.get(el);
    if (!m) { m = new Map(); cache.set(el, m); }
    const k = simpleKey(s);
    if (m.has(k)) return m.get(k)!;
    const ok = raw(el, s);
    m.set(k, ok);
    return ok;
  }

  // Helpers DOM (assumem DOM-like API; adapte se teu DOM for custom)
  function getAttr(el: Element, name: string): string | null {
    const value = (el as any).getAttribute ? (el as any).getAttribute(name) : null;
    return value;
  }

  function matchAttr(el: Element, cond: AttrCond): boolean {
    const v = getAttr(el, cond.name);
    if (cond.op === 'exists') {
      const result = v !== null;
      return result;
    }
    if (v === null) {
      return false;
    }
    let result: boolean;
    switch (cond.op) {
      case '=':   result = v === cond.value!; break;
      case '~=':  result = v.split(/\s+/).includes(cond.value!); break;
      case '|=': result = v === cond.value! || v.startsWith(cond.value! + '-'); break;
      case '^=':  result = v.startsWith(cond.value!); break;
      case '$=': result = v.endsWith(cond.value!); break;
      case '*=':  result = v.includes(cond.value!); break;
      default: result = false; break;
    }
    return result;
  }

  function indexInParent(el: Element): number {
    const p = el.parentElement;
    if (!p) {
      return -1;
    }
    let idx = 0;
    for (let n = p.firstElementChild; n; n = n.nextElementSibling) {
      idx++;
      if (n === el) {
        return idx;
      }
    }
    return -1;
  }

  function matchesPseudo(el: Element, p: Pseudo): boolean {
    if (p.kind === 'first-child') {
      const result = indexInParent(el) === 1;
      return result;
    }
    if (p.kind === 'last-child') {
      const parent = el.parentElement;
      if (!parent) {
        return false;
      }
      const result = parent.lastElementChild === el;
      return result;
    }
    if (p.kind === 'nth-child') {
      const k = indexInParent(el);
      if (k < 1) {
        return false;
      }
      const { a, b } = p;
      let result: boolean;
      if (a === 0) {
        result = k === b;
      } else {
        result = (k - b) % a === 0 && (k - b) / a >= 0;
      }
      return result;
    }
    if (p.kind === 'not') {
      const result = !matchesSimple(el, p.inner);
      return result;
    }
    return false;
  }

  function matchesSimple(el: Element, s: Simple): boolean {
    if (s.tag && el.tagName.toLowerCase() !== s.tag) {
      return false;
    }
    if (s.id && (el as any).id !== s.id) {
      return false;
    }
    const cl: DOMTokenList | undefined = (el as any).classList;
    for (const cls of s.classes) {
      if (!cl?.contains?.(cls)) {
        return false;
      }
    }
    for (const a of s.attrs) {
      if (!matchAttr(el, a)) {
        return false;
      }
    }
    for (const z of s.pseudos) {
      if (!matchesPseudo(el, z)) {
        return false;
      }
    }
    return true;
  }

  // Matcher right-to-left
  return function match(el: Element): boolean {
    let current: Element | null = el;
    let i = chain.length - 1;

    if (!current) {
      return false;
    }
    if (!memo(current, chain[i].simple, matchesSimple)) {
      return false;
    }
    i--;

    while (i >= 0) {
      const needed = chain[i];
      const comb = chain[i + 1].combinatorToLeft as Combinator | undefined;

      if (comb === '>') {
        current = current!.parentElement;
        if (!current) {
          return false;
        }
        if (!memo(current, needed.simple, matchesSimple)) {
          return false;
        }
        i--; continue;
      }

      if (comb === ' ') {
        let anc: Element | null = current!.parentElement, found = false;
        while (anc) {
          if (memo(anc, needed.simple, matchesSimple)) {
            current = anc;
            found = true;
            break;
          }
          anc = anc.parentElement;
        }
        if (!found) {
          return false;
        }
        i--; continue;
      }

      if (comb === '+') {
        const sib = current!.previousElementSibling as Element | null;
        if (!sib) {
          return false;
        }
        if (!memo(sib, needed.simple, matchesSimple)) {
          return false;
        }
        current = sib; i--; continue;
      }

      if (comb === '~') {
        let sib = current!.previousElementSibling as Element | null, found = false;
        while (sib) {
          if (memo(sib, needed.simple, matchesSimple)) {
            current = sib;
            found = true;
            break;
          }
          sib = sib.previousElementSibling as Element | null;
        }
        if (!found) {
          return false;
        }
        i--; continue;
      }

      // sem combinador à esquerda (primeiro item, raro cair aqui)
      if (!memo(current!, needed.simple, matchesSimple)) {
        return false;
      }
      i--;
    }
    return true;
  };
}
