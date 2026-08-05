export type Specificity = readonly [number, number, number];

/**
 * CSS specificity represented as [IDs, classes/attributes/pseudo-classes, types].
 * :not() contributes the specificity of its argument, but not of :not itself.
 */
export function computeSpecificity(selector: string): Specificity {
  const tokens = selector
    .trim()
    .replace(/\s+/g, " ")
    .split(/(?=\s|>|\+|~)|(?<=\s|>|\+|~)/)
    .map((token) => token.trim())
    .filter((token) => token && !/^(?:>|~|\+)$/.test(token));

  let ids = 0;
  let classLike = 0;
  let types = 0;
  const count = (expression: RegExp, value: string): number =>
    (value.match(expression) ?? []).length;

  for (const token of tokens) {
    const notFunctions = token.match(/:not\(([^)]+)\)/g) ?? [];
    for (const notFunction of notFunctions) {
      const inner = notFunction.replace(/^:not\(|\)$/g, "");
      const [innerIds, innerClassLike, innerTypes] = computeSpecificity(inner);
      ids += innerIds;
      classLike += innerClassLike;
      types += innerTypes;
    }

    let remainder = token.replace(/:not\(([^)]+)\)/g, "");

    const pseudoElements = count(/::[a-zA-Z_][\w-]*/g, remainder);
    types += pseudoElements;
    remainder = remainder.replace(/::[a-zA-Z_][\w-]*/g, "");

    ids += count(/#[a-zA-Z_][\w-]*/g, remainder);
    classLike += count(/\.[a-zA-Z_][\w-]*/g, remainder);
    classLike += count(/\[[^\]]+\]/g, remainder);
    classLike += count(/:(?!:)[a-zA-Z_][\w-]*(?:\([^)]*\))?/g, remainder);

    const typeSelector = /^[a-zA-Z_][\w-]*/.exec(remainder);
    if (typeSelector && typeSelector[0] !== "*") {
      types++;
    }
  }

  return [ids, classLike, types];
}
