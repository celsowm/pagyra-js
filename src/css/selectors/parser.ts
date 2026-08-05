import type { Part, Simple, AttrCond, AttrOp, Pseudo } from "./types.js";

/**
 * Lightweight CSS selector parser.
 * Supports compound selectors, attributes, structural pseudo-classes and the
 * descendant, child, adjacent-sibling and general-sibling combinators.
 */
export function parseSelector(selector: string): Part[] | null {
  if (!selector?.trim()) {
    return null;
  }

  function parseNth(expr: string): { a: number; b: number } | null {
    const normalized = expr.replace(/\s+/g, "").toLowerCase();
    if (normalized === "odd") {
      return { a: 2, b: 1 };
    }
    if (normalized === "even") {
      return { a: 2, b: 0 };
    }
    if (/^[+-]?\d+$/.test(normalized)) {
      return { a: 0, b: parseInt(normalized, 10) };
    }
    const match = /^([+-]?\d*)n([+-]?\d+)?$/.exec(normalized);
    if (!match) {
      return null;
    }
    const a = match[1] === "" || match[1] === "+"
      ? 1
      : match[1] === "-"
        ? -1
        : parseInt(match[1], 10);
    const b = match[2] ? parseInt(match[2], 10) : 0;
    return { a, b };
  }

  function parseSimpleToken(token: string): Simple | null {
    let rest = token.trim();
    if (!rest) {
      return null;
    }

    let tag: string | null = null;
    if (rest[0] === "*") {
      rest = rest.slice(1);
    } else if (!["#", ".", "[", ":"].includes(rest[0])) {
      const match = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(rest);
      if (match) {
        tag = match[0].toLowerCase();
        rest = rest.slice(match[0].length);
      }
    }

    let id: string | null = null;
    const classes: string[] = [];
    const attrs: AttrCond[] = [];
    const pseudos: Pseudo[] = [];

    while (rest.length > 0) {
      const character = rest[0];
      if (character === "#") {
        const match = /^#[^.#[\]:\s>+~]+/.exec(rest);
        if (!match) {
          return null;
        }
        id = match[0].slice(1);
        rest = rest.slice(match[0].length);
        continue;
      }
      if (character === ".") {
        const match = /^\.[^.#[\]:\s>+~]+/.exec(rest);
        if (!match) {
          return null;
        }
        classes.push(match[0].slice(1));
        rest = rest.slice(match[0].length);
        continue;
      }
      if (character === "[") {
        const match = /^\[(\s*[-\w:]+\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]-\s]+))\s*)?)\]/.exec(rest);
        if (!match) {
          return null;
        }
        const name = match[1].match(/^[-\w:]+/)?.[0];
        if (!name) {
          return null;
        }
        const op = (match[2] as AttrOp) ?? "exists";
        const value = match[3] ?? match[4] ?? match[5];
        attrs.push(op === "exists" ? { name, op } : { name, op, value: value! });
        rest = rest.slice(match[0].length);
        continue;
      }
      if (character !== ":") {
        return null;
      }

      let match = /^:first-child\b/i.exec(rest);
      if (match) {
        pseudos.push({ kind: "first-child" });
        rest = rest.slice(match[0].length);
        continue;
      }
      match = /^:last-child\b/i.exec(rest);
      if (match) {
        pseudos.push({ kind: "last-child" });
        rest = rest.slice(match[0].length);
        continue;
      }
      match = /^:only-child\b/i.exec(rest);
      if (match) {
        pseudos.push({ kind: "only-child" });
        rest = rest.slice(match[0].length);
        continue;
      }
      match = /^:first-of-type\b/i.exec(rest);
      if (match) {
        pseudos.push({ kind: "first-of-type" });
        rest = rest.slice(match[0].length);
        continue;
      }
      match = /^:last-of-type\b/i.exec(rest);
      if (match) {
        pseudos.push({ kind: "last-of-type" });
        rest = rest.slice(match[0].length);
        continue;
      }
      match = /^:only-of-type\b/i.exec(rest);
      if (match) {
        pseudos.push({ kind: "only-of-type" });
        rest = rest.slice(match[0].length);
        continue;
      }
      match = /^:empty\b/i.exec(rest);
      if (match) {
        pseudos.push({ kind: "empty" });
        rest = rest.slice(match[0].length);
        continue;
      }
      match = /^:root\b/i.exec(rest);
      if (match) {
        pseudos.push({ kind: "root" });
        rest = rest.slice(match[0].length);
        continue;
      }
      match = /^:nth-child\(\s*([^)]+)\s*\)/i.exec(rest);
      if (match) {
        const expression = parseNth(match[1]);
        if (!expression) {
          return null;
        }
        pseudos.push({ kind: "nth-child", ...expression });
        rest = rest.slice(match[0].length);
        continue;
      }
      match = /^:nth-of-type\(\s*([^)]+)\s*\)/i.exec(rest);
      if (match) {
        const expression = parseNth(match[1]);
        if (!expression) {
          return null;
        }
        pseudos.push({ kind: "nth-of-type", ...expression });
        rest = rest.slice(match[0].length);
        continue;
      }
      match = /^:not\(\s*([^)]+)\s*\)/i.exec(rest);
      if (match) {
        const inner = parseSimpleToken(match[1]);
        if (!inner) {
          return null;
        }
        pseudos.push({ kind: "not", inner });
        rest = rest.slice(match[0].length);
        continue;
      }

      return null;
    }

    return { tag, id, classes, attrs, pseudos };
  }

  const normalizedSelector = selector.trim().replace(/\s+/g, " ");
  const tokens: (Simple | " " | ">" | "+" | "~")[] = [];
  let index = 0;
  while (index < normalizedSelector.length) {
    const character = normalizedSelector[index];
    if (character === " " || character === ">" || character === "+" || character === "~") {
      if (character === " ") {
        while (normalizedSelector[index] === " ") {
          index++;
        }
        tokens.push(" ");
      } else {
        tokens.push(character);
        index++;
        while (normalizedSelector[index] === " ") {
          index++;
        }
      }
      continue;
    }

    let end = index;
    let squareDepth = 0;
    let parenthesisDepth = 0;
    while (end < normalizedSelector.length) {
      const current = normalizedSelector[end];
      if (current === "[") {
        squareDepth++;
      } else if (current === "]") {
        squareDepth = Math.max(0, squareDepth - 1);
      } else if (current === "(") {
        parenthesisDepth++;
      } else if (current === ")") {
        parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      } else if (
        squareDepth === 0
        && parenthesisDepth === 0
        && (current === " " || current === ">" || current === "+" || current === "~")
      ) {
        break;
      }
      end++;
    }

    const simple = parseSimpleToken(normalizedSelector.slice(index, end));
    if (!simple) {
      return null;
    }
    tokens.push(simple);
    index = end;
  }

  const parts: Part[] = [];
  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
    const token = tokens[tokenIndex];
    if (typeof token === "string") {
      continue;
    }

    let combinatorToLeft: " " | ">" | "+" | "~" | undefined;
    let previousIndex = tokenIndex - 1;
    if (previousIndex >= 0 && tokens[previousIndex] === " ") {
      combinatorToLeft = " ";
      previousIndex--;
    }
    if (
      previousIndex >= 0
      && typeof tokens[previousIndex] === "string"
      && tokens[previousIndex] !== " "
    ) {
      combinatorToLeft = tokens[previousIndex] as ">" | "+" | "~";
    }
    parts.push({ simple: token, combinatorToLeft });
  }

  return parts.length > 0 ? parts : null;
}
