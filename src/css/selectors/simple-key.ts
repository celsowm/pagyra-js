import type { Pseudo, Simple } from "./types.js";

/** Generates a stable canonical cache key for a compound selector. */
export function simpleKey(simple: Simple): string {
  const classes = simple.classes.length > 0
    ? `.${simple.classes.slice().sort().join(".")}`
    : "";
  const attributes = simple.attrs.length > 0
    ? `[${simple.attrs
        .map((attribute) => attribute.op === "exists"
          ? attribute.name
          : `${attribute.name}${attribute.op}\"${attribute.value}\"`)
        .sort()
        .join("][")}]`
    : "";
  const pseudos = simple.pseudos.length > 0
    ? `:${simple.pseudos.map(pseudoKey).sort().join(":")}`
    : "";
  const tag = simple.tag ?? "*";
  const id = simple.id ? `#${simple.id}` : "";
  return `${tag}${id}${classes}${attributes}${pseudos}`;
}

function pseudoKey(pseudo: Pseudo): string {
  switch (pseudo.kind) {
    case "first-child":
    case "last-child":
    case "only-child":
    case "first-of-type":
    case "last-of-type":
    case "only-of-type":
    case "empty":
    case "root":
      return pseudo.kind;
    case "nth-child":
    case "nth-of-type":
      return `${pseudo.kind}(${pseudo.a}n+${pseudo.b})`;
    case "not":
      return `not(${simpleKey(pseudo.inner)})`;
  }
}
