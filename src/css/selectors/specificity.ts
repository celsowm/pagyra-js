export type Specificity = readonly [number, number, number];

/**
 * Especificidade simplificada e prática:
 *  a = nº de IDs
 *  b = nº de classes + atributos + pseudo-classes (inclui :not(inner) somando o inner)
 *  c = nº de tags (ignora '*')
 */
export function computeSpecificity(selector: string): Specificity {
  const tokens = selector
    .trim()
    .replace(/\s+/g, ' ')
    // separa por combinadores de topo mantendo pedacinhos simples
    .split(/(?=\s|>|\+|~)|(?<=\s|>|\+|~)/)
    .map(s => s.trim())
    .filter(s => s && !/^(?:>|~|\+)$/.test(s));

  let a = 0, b = 0, c = 0;
  const countOf = (re: RegExp, str: string) => (str.match(re) ?? []).length;

  for (const t of tokens) {
    // :not(inner) — soma especificidade do inner; o :not em si não conta
    const nots = t.match(/:not\(([^)]+)\)/g) ?? [];
    for (const n of nots) {
      const inner = n.replace(/^:not\(|\)$/g, '');
      const [ia, ib, ic] = computeSpecificity(inner);
      a += ia; b += ib; c += ic;
    }
    const noNot = t.replace(/:not\(([^)]+)\)/g, '');

    a += countOf(/#[^.#\[\]:\s>+~]+/g, noNot);              // IDs
    b += countOf(/\.[^.#\[\]:\s>+~]+/g, noNot);            // classes
    b += countOf(/\[[^\]]+\]/g, noNot);                    // atributos
    b += countOf(/:(?!:)[a-z-]+(\([^)]+\))?/g, noNot);     // pseudo-classes

    const m = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(noNot);
    if (m && !/^[.#\[:]/.test(noNot) && m[0] !== '*') c += 1; // tag
  }

  return [a, b, c];
}
