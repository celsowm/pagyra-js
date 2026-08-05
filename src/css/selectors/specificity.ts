export type Specificity = readonly [number, number, number];

/** CSS specificity represented as [IDs, classes/attributes/pseudo-classes, types]. */
export function computeSpecificity(selector: string): Specificity {
  const alternatives = splitTopLevelList(selector);
  if (alternatives.length > 1) {
    return maxSpecificity(alternatives.map(computeSpecificity));
  }
  return computeSingleSelectorSpecificity(alternatives[0] ?? "");
}

function computeSingleSelectorSpecificity(selector: string): Specificity {
  let ids = 0;
  let classLike = 0;
  let types = 0;
  let index = 0;
  let atCompoundStart = true;

  while (index < selector.length) {
    const character = selector[index];

    if (/\s/.test(character) || character === ">" || character === "+" || character === "~" || character === ",") {
      atCompoundStart = true;
      index++;
      continue;
    }

    if (character === "*") {
      atCompoundStart = false;
      index++;
      continue;
    }

    if (character === "#") {
      ids++;
      index = consumeIdentifier(selector, index + 1);
      atCompoundStart = false;
      continue;
    }

    if (character === ".") {
      classLike++;
      index = consumeIdentifier(selector, index + 1);
      atCompoundStart = false;
      continue;
    }

    if (character === "[") {
      classLike++;
      index = consumeBalanced(selector, index, "[", "]").end;
      atCompoundStart = false;
      continue;
    }

    if (character === ":") {
      if (selector[index + 1] === ":") {
        types++;
        index = consumeIdentifier(selector, index + 2);
        if (selector[index] === "(") {
          index = consumeBalanced(selector, index, "(", ")").end;
        }
        atCompoundStart = false;
        continue;
      }

      const nameStart = index + 1;
      const nameEnd = consumeIdentifier(selector, nameStart);
      const name = selector.slice(nameStart, nameEnd).toLowerCase();
      index = nameEnd;

      if (selector[index] !== "(") {
        classLike++;
        atCompoundStart = false;
        continue;
      }

      const functional = consumeBalanced(selector, index, "(", ")");
      const body = selector.slice(index + 1, functional.end - 1);
      index = functional.end;

      if (name === "where") {
        atCompoundStart = false;
        continue;
      }

      if (name === "is" || name === "not" || name === "has") {
        const [innerIds, innerClassLike, innerTypes] = maxSpecificity(
          splitTopLevelList(body).map(computeSpecificity),
        );
        ids += innerIds;
        classLike += innerClassLike;
        types += innerTypes;
        atCompoundStart = false;
        continue;
      }

      classLike++;
      atCompoundStart = false;
      continue;
    }

    if (isIdentifierStart(character)) {
      if (atCompoundStart) {
        types++;
      }
      index = consumeIdentifier(selector, index);
      atCompoundStart = false;
      continue;
    }

    index++;
  }

  return [ids, classLike, types];
}

function maxSpecificity(values: readonly Specificity[]): Specificity {
  let maximum: Specificity = [0, 0, 0];
  for (const value of values) {
    if (compareSpecificity(value, maximum) > 0) {
      maximum = value;
    }
  }
  return maximum;
}

function compareSpecificity(left: Specificity, right: Specificity): number {
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

function splitTopLevelList(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let parenthesisDepth = 0;
  let squareDepth = 0;
  let quote: "\"" | "'" | null = null;

  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (quote) {
      current += character;
      if (character === quote && value[index - 1] !== "\\") {
        quote = null;
      }
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(") {
      parenthesisDepth++;
    } else if (character === ")") {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    } else if (character === "[") {
      squareDepth++;
    } else if (character === "]") {
      squareDepth = Math.max(0, squareDepth - 1);
    }

    if (character === "," && parenthesisDepth === 0 && squareDepth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = "";
    } else {
      current += character;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts.length > 0 ? parts : [""];
}

function consumeBalanced(
  value: string,
  start: number,
  open: "(" | "[",
  close: ")" | "]",
): { end: number } {
  let depth = 0;
  let quote: "\"" | "'" | null = null;
  for (let index = start; index < value.length; index++) {
    const character = value[index];
    if (quote) {
      if (character === quote && value[index - 1] !== "\\") {
        quote = null;
      }
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === open) {
      depth++;
    } else if (character === close) {
      depth--;
      if (depth === 0) {
        return { end: index + 1 };
      }
    }
  }
  return { end: value.length };
}

function consumeIdentifier(value: string, start: number): number {
  let index = start;
  while (index < value.length && /[\w-]/.test(value[index])) {
    index++;
  }
  return index;
}

function isIdentifierStart(character: string): boolean {
  return /[a-zA-Z_]/.test(character);
}
