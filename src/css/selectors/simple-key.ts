import type { Simple } from "./types.js";

/**
 * Gera uma chave canônica estável para memoização de matches de "Simple".
 */
export function simpleKey(s: Simple): string {
  console.log(`[SELECTOR DEBUG] Generating simple key for:`, s);
  const cls = s.classes.length ? '.' + s.classes.slice().sort().join('.') : '';
  const attrs = s.attrs.length
    ? '[' + s.attrs
        .map(a => a.op === 'exists' ? a.name : `${a.name}${a.op}"${a.value}"`)
        .sort().join('][') + ']'
    : '';
  const pseu = s.pseudos.length
    ? ':' + s.pseudos.map(p => {
        switch (p.kind) {
          case 'first-child': return 'first-child';
          case 'last-child':  return 'last-child';
          case 'nth-child':   return `nth-child(${p.a}n+${p.b})`;
          case 'not': {
            const innerKey = simpleKey(p.inner);
            console.log(`[SELECTOR DEBUG] Generated not() inner key: ${innerKey}`);
            return `not(${innerKey})`;
          }
          default: return '';
        }
      }).filter(p => p !== '').sort().join(':')
    : '';
  const tag = s.tag ?? '*';
  const id  = s.id ? `#${s.id}` : '';
  const key = `${tag}${id}${cls}${attrs}${pseu}`;
  console.log(`[SELECTOR DEBUG] Generated simple key: ${key}`);
  return key;
}
