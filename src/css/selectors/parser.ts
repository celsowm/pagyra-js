import type { Part, Simple, AttrCond, AttrOp, Pseudo } from "./types.js";

/**
 * Parser leve de seletor CSS → cadeia de Parts (compostos) com combinador à esquerda.
 * Suporta: tag, #id, .classe, [attr ops], :first/last/nth-child, :not(simple)
 * Combinadores: ' ' (desc), '>' (filho), '+' (irmão adjacente), '~' (irmãos)
 */
export function parseSelector(selector: string): Part[] | null {
  console.log(`[SELECTOR DEBUG] Parsing selector: ${selector}`);
  if (!selector?.trim()) {
    console.log(`[SELECTOR DEBUG] Selector is empty or null`);
    return null;
  }

  function parseNth(expr: string): { a: number; b: number } | null {
    console.log(`[SELECTOR DEBUG] Parsing nth expression: ${expr}`);
    const s = expr.replace(/\s+/g, '');
    if (s === 'odd') {
      console.log(`[SELECTOR DEBUG] nth expression is 'odd': { a: 2, b: 1 }`);
      return { a: 2, b: 1 };
    }
    if (s === 'even') {
      console.log(`[SELECTOR DEBUG] nth expression is 'even': { a: 2, b: 0 }`);
      return { a: 2, b: 0 };
    }
    if (/^[+-]?\d+$/.test(s)) {
      const result = { a: 0, b: parseInt(s, 10) };
      console.log(`[SELECTOR DEBUG] nth expression is number:`, result);
      return result;
    }
    const m = /^([+-]?\d*)n([+-]?\d+)?$/.exec(s);
    if (!m) {
      console.log(`[SELECTOR DEBUG] nth expression doesn't match pattern`);
      return null;
    }
    const a = m[1] === '' || m[1] === '+' ? 1 : (m[1] === '-' ? -1 : parseInt(m[1], 10));
    const b = m[2] ? parseInt(m[2], 10) : 0;
    const result = { a, b };
    console.log(`[SELECTOR DEBUG] nth expression parsed:`, result);
    return result;
  }

  function parseSimpleToken(tok: string): Simple | null {
    console.log(`[SELECTOR DEBUG] Parsing simple token: ${tok}`);
    let rest = tok.trim();
    if (!rest) {
      console.log(`[SELECTOR DEBUG] Token is empty after trim`);
      return null;
    }

    let tag: string | null = null;
    if (rest[0] === '*') { tag = null; rest = rest.slice(1); }
    else if (!['#', '.', '[', ':'].includes(rest[0])) {
      const m = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(rest);
      if (m) { tag = m[0].toLowerCase(); rest = rest.slice(m[0].length); }
    }

    let id: string | null = null;
    const classes: string[] = [];
    const attrs: AttrCond[] = [];
    const pseudos: Pseudo[] = [];

    while (rest.length) {
      const ch = rest[0];
      if (ch === '#') {
        const m = /^#[^.#\[\]:\s>+~]+/.exec(rest);
        if (!m) break;
        id = m[0].slice(1);
        rest = rest.slice(m[0].length);
        console.log(`[SELECTOR DEBUG] Parsed ID: ${id}`);
        continue;
      }
      if (ch === '.') {
        const m = /^\.[^.#\[\]:\s>+~]+/.exec(rest);
        if (!m) break;
        classes.push(m[0].slice(1));
        rest = rest.slice(m[0].length);
        console.log(`[SELECTOR DEBUG] Parsed class: ${m[0].slice(1)}`);
        continue;
      }
      if (ch === '[') {
        const m = /^\[(\s*[-\w:]+\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*)?)\]/.exec(rest);
        if (!m) break;
        const name = m[1].match(/^[-\w:]+/)![0];
        const op = (m[2] as AttrOp) ?? 'exists';
        const val = m[3] ?? m[4] ?? m[5];
        const attr = op === 'exists' ? { name, op } : { name, op, value: val! };
        attrs.push(attr);
        rest = rest.slice(m[0].length);
        console.log(`[SELECTOR DEBUG] Parsed attribute:`, attr);
        continue;
      }
      if (ch === ':') {
        // pseudos básicas
        let m = /^:first-child/.exec(rest);
        if (m) { pseudos.push({ kind: 'first-child' }); rest = rest.slice(m[0].length); console.log(`[SELECTOR DEBUG] Parsed first-child pseudo`); continue; }
        m = /^:last-child/.exec(rest);
        if (m) { pseudos.push({ kind: 'last-child' }); rest = rest.slice(m[0].length); console.log(`[SELECTOR DEBUG] Parsed last-child pseudo`); continue; }
        m = /^:nth-child\(\s*([^)]+)\s*\)/.exec(rest);
        if (m) {
          const nb = parseNth(m[1]); 
          if (nb) {
            pseudos.push({ kind: 'nth-child', a: nb.a, b: nb.b });
            console.log(`[SELECTOR DEBUG] Parsed nth-child pseudo:`, { kind: 'nth-child', a: nb.a, b: nb.b });
          }
          rest = rest.slice(m[0].length); continue;
        }
        m = /^:not\(\s*([^)]+)\s*\)/.exec(rest);
        if (m) {
          const innerTok = m[1];
          const inner = parseSimpleToken(innerTok); // um nível simples
          if (inner) pseudos.push({ kind: 'not', inner });
          rest = rest.slice(m[0].length); 
          console.log(`[SELECTOR DEBUG] Parsed not() pseudo with inner:`, inner);
          continue;
        }
        // pseudo desconhecida → aborta para manter comportamento previsível
        console.log(`[SELECTOR DEBUG] Unknown pseudo class, returning null`);
        return null;
      }
      break; // nada mais reconhecido
    }

    const result = { tag, id, classes, attrs, pseudos };
    console.log(`[SELECTOR DEBUG] Parsed simple token result:`, result);
    return result;
  }

  // Tokenização topo-nível preservando combinadores (não entra em []/())
  const s = selector.trim().replace(/\s+/g, ' ');
  console.log(`[SELECTOR DEBUG] Normalized selector: ${s}`);
  const tokens: (Simple | ' ' | '>' | '+' | '~')[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '>' || c === '+' || c === '~') {
      if (c === ' ') { while (s[i] === ' ') i++; tokens.push(' '); console.log(`[SELECTOR DEBUG] Added space combinator`); }
      else { tokens.push(c as any); i++; if (s[i] === ' ') i++; console.log(`[SELECTOR DEBUG] Added combinator: ${c}`); }
      continue;
    }
    let j = i, depthSq = 0, depthPar = 0;
    while (j < s.length) {
      const ch = s[j];
      if (ch === '[') depthSq++;
      else if (ch === ']') depthSq = Math.max(0, depthSq - 1);
      else if (ch === '(') depthPar++;
      else if (ch === ')') depthPar = Math.max(0, depthPar - 1);
      else if (depthSq === 0 && depthPar === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) break;
      j++;
    }
    const raw = s.slice(i, j);
    console.log(`[SELECTOR DEBUG] Processing raw token: ${raw}`);
    const simp = parseSimpleToken(raw);
    if (!simp) {
      console.log(`[SELECTOR DEBUG] Failed to parse simple token: ${raw}`);
      return null;
    }
    tokens.push(simp);
    i = j;
  }

  // Constrói Parts com o combinador imediatamente à esquerda
  const parts: Part[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (typeof t !== 'string') {
      let comb: ' ' | '>' | '+' | '~' | undefined = undefined;

      // procura combinador direto à esquerda (pulando espaços redundantes)
      let p = k - 1;
      // se houver espaços encadeados, tratamos como um único '
      while (p >= 0 && tokens[p] === ' ') { comb = ' '; p--; break; }
      if (p >= 0 && typeof tokens[p] === 'string' && tokens[p] !== ' ') comb = tokens[p] as any;

      const part = { simple: t, combinatorToLeft: comb };
      parts.push(part);
      console.log(`[SELECTOR DEBUG] Created part:`, part);
    }
  }
  const result = parts.length ? parts : null;
  console.log(`[SELECTOR DEBUG] Final parse result:`, result);
  return result;
}
