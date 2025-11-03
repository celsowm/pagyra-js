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
    console.log(`[SELECTOR DEBUG] Memoized simple match for element ${el.tagName} with key ${k}: ${ok}`);
    return ok;
  }

  // Helpers DOM (assumem DOM-like API; adapte se teu DOM for custom)
  function getAttr(el: Element, name: string): string | null {
    const value = (el as any).getAttribute ? (el as any).getAttribute(name) : null;
    console.log(`[SELECTOR DEBUG] Getting attribute ${name} from element ${el.tagName}: ${value}`);
    return value;
  }

  function matchAttr(el: Element, cond: AttrCond): boolean {
    console.log(`[SELECTOR DEBUG] Matching attribute condition:`, cond);
    const v = getAttr(el, cond.name);
    if (cond.op === 'exists') {
      const result = v !== null;
      console.log(`[SELECTOR DEBUG] Attr exists check: ${result}`);
      return result;
    }
    if (v === null) {
      console.log(`[SELECTOR DEBUG] Attr value is null, returning false`);
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
    console.log(`[SELECTOR DEBUG] Attr match result: ${result} for ${cond.name} ${cond.op} ${cond.value} = ${v}`);
    return result;
  }

  function indexInParent(el: Element): number {
    console.log(`[SELECTOR DEBUG] Getting index of element ${el.tagName} in parent`);
    const p = el.parentElement;
    if (!p) {
      console.log(`[SELECTOR DEBUG] No parent element`);
      return -1;
    }
    let idx = 0;
    for (let n = p.firstElementChild; n; n = n.nextElementSibling) {
      idx++;
      if (n === el) {
        console.log(`[SELECTOR DEBUG] Found element at index ${idx}`);
        return idx;
      }
    }
    console.log(`[SELECTOR DEBUG] Element not found in parent, returning -1`);
    return -1;
  }

  function matchesPseudo(el: Element, p: Pseudo): boolean {
    console.log(`[SELECTOR DEBUG] Matching pseudo ${p.kind}`, p);
    if (p.kind === 'first-child') {
      const result = indexInParent(el) === 1;
      console.log(`[SELECTOR DEBUG] first-child result: ${result}`);
      return result;
    }
    if (p.kind === 'last-child') {
      const parent = el.parentElement;
      if (!parent) {
        console.log(`[SELECTOR DEBUG] last-child: no parent, returning false`);
        return false;
      }
      const result = parent.lastElementChild === el;
      console.log(`[SELECTOR DEBUG] last-child result: ${result}`);
      return result;
    }
    if (p.kind === 'nth-child') {
      const k = indexInParent(el);
      if (k < 1) {
        console.log(`[SELECTOR DEBUG] nth-child: element not found in parent, returning false`);
        return false;
      }
      const { a, b } = p;
      let result: boolean;
      if (a === 0) {
        result = k === b;
      } else {
        result = (k - b) % a === 0 && (k - b) / a >= 0;
      }
      console.log(`[SELECTOR DEBUG] nth-child(${a}n+${b}) for position ${k}: ${result}`);
      return result;
    }
    if (p.kind === 'not') {
      const result = !matchesSimple(el, p.inner);
      console.log(`[SELECTOR DEBUG] not() result: ${result}`);
      return result;
    }
    console.log(`[SELECTOR DEBUG] Unknown pseudo type, returning false`);
    return false;
  }

  function matchesSimple(el: Element, s: Simple): boolean {
    console.log(`[SELECTOR DEBUG] Matching simple selector:`, s);
    if (s.tag && el.tagName.toLowerCase() !== s.tag) {
      console.log(`[SELECTOR DEBUG] Tag mismatch: ${el.tagName.toLowerCase()} !== ${s.tag}`);
      return false;
    }
    if (s.id && (el as any).id !== s.id) {
      console.log(`[SELECTOR DEBUG] ID mismatch: ${(el as any).id} !== ${s.id}`);
      return false;
    }
    const cl: DOMTokenList | undefined = (el as any).classList;
    for (const cls of s.classes) {
      if (!cl?.contains?.(cls)) {
        console.log(`[SELECTOR DEBUG] Class mismatch: element doesn't have class ${cls}`);
        return false;
      }
    }
    for (const a of s.attrs) {
      if (!matchAttr(el, a)) {
        console.log(`[SELECTOR DEBUG] Attr mismatch: attribute condition failed`);
        return false;
      }
    }
    for (const z of s.pseudos) {
      if (!matchesPseudo(el, z)) {
        console.log(`[SELECTOR DEBUG] Pseudo mismatch: pseudo condition failed`);
        return false;
      }
    }
    console.log(`[SELECTOR DEBUG] Simple selector matched successfully`);
    return true;
  }

  // Matcher right-to-left
  return function match(el: Element): boolean {
    console.log(`[SELECTOR DEBUG] Starting match for selector: ${selector}`, { element: el.tagName, chain });
    let current: Element | null = el;
    let i = chain.length - 1;

    if (!current) {
      console.log(`[SELECTOR DEBUG] No current element, returning false`);
      return false;
    }
    if (!memo(current, chain[i].simple, matchesSimple)) {
      console.log(`[SELECTOR DEBUG] First simple match failed`);
      return false;
    }
    console.log(`[SELECTOR DEBUG] First simple match succeeded`);
    i--;

    while (i >= 0) {
      const needed = chain[i];
      const comb = chain[i + 1].combinatorToLeft as Combinator | undefined;
      console.log(`[SELECTOR DEBUG] Processing combinator: ${comb}, needed:`, needed);

      if (comb === '>') {
        current = current!.parentElement;
        if (!current) {
          console.log(`[SELECTOR DEBUG] No parent element for > combinator`);
          return false;
        }
        if (!memo(current, needed.simple, matchesSimple)) {
          console.log(`[SELECTOR DEBUG] Parent match failed for > combinator`);
          return false;
        }
        console.log(`[SELECTOR DEBUG] Parent match succeeded for > combinator`);
        i--; continue;
      }

      if (comb === ' ') {
        let anc: Element | null = current!.parentElement, found = false;
        console.log(`[SELECTOR DEBUG] Starting ancestor search for descendant combinator`);
        while (anc) {
          if (memo(anc, needed.simple, matchesSimple)) {
            console.log(`[SELECTOR DEBUG] Found matching ancestor`);
            current = anc;
            found = true;
            break;
          }
          anc = anc.parentElement;
        }
        if (!found) {
          console.log(`[SELECTOR DEBUG] No matching ancestor found for descendant combinator`);
          return false;
        }
        i--; continue;
      }

      if (comb === '+') {
        const sib = current!.previousElementSibling as Element | null;
        if (!sib) {
          console.log(`[SELECTOR DEBUG] No previous sibling for + combinator`);
          return false;
        }
        if (!memo(sib, needed.simple, matchesSimple)) {
          console.log(`[SELECTOR DEBUG] Previous sibling match failed for + combinator`);
          return false;
        }
        console.log(`[SELECTOR DEBUG] Previous sibling match succeeded for + combinator`);
        current = sib; i--; continue;
      }

      if (comb === '~') {
        let sib = current!.previousElementSibling as Element | null, found = false;
        console.log(`[SELECTOR DEBUG] Starting sibling search for ~ combinator`);
        while (sib) {
          if (memo(sib, needed.simple, matchesSimple)) {
            console.log(`[SELECTOR DEBUG] Found matching sibling`);
            current = sib;
            found = true;
            break;
          }
          sib = sib.previousElementSibling as Element | null;
        }
        if (!found) {
          console.log(`[SELECTOR DEBUG] No matching sibling found for ~ combinator`);
          return false;
        }
        i--; continue;
      }

      // sem combinador à esquerda (primeiro item, raro cair aqui)
      if (!memo(current!, needed.simple, matchesSimple)) {
        console.log(`[SELECTOR DEBUG] Simple match failed for first item`);
        return false;
      }
      console.log(`[SELECTOR DEBUG] Simple match succeeded for first item`);
      i--;
    }
    console.log(`[SELECTOR DEBUG] Final match result: true`);
    return true;
  };
}
