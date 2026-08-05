export interface InlineDeclarationEntry {
  property: string;
  value: string;
  important: boolean;
  sourceOrder: number;
}

function normalizeProperty(property: string): string {
  const trimmed = property.trim();
  return trimmed.startsWith("--") ? trimmed : trimmed.toLowerCase();
}

function splitImportant(value: string): { value: string; important: boolean } {
  const match = /!\s*important\s*$/i.exec(value);
  if (!match || match.index === undefined) {
    return { value: value.trim(), important: false };
  }
  return {
    value: value.slice(0, match.index).trim(),
    important: true,
  };
}

function splitDeclarationText(style: string): string[] {
  const declarations: string[] = [];
  let current = "";
  let quote: "\"" | "'" | undefined;
  let escaped = false;
  let parenthesesDepth = 0;

  for (const character of style) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === "\"" || character === "'") {
      current += character;
      quote = character;
      continue;
    }
    if (character === "(") {
      current += character;
      parenthesesDepth++;
      continue;
    }
    if (character === ")") {
      current += character;
      parenthesesDepth = Math.max(0, parenthesesDepth - 1);
      continue;
    }
    if (character === ";" && parenthesesDepth === 0) {
      declarations.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim()) {
    declarations.push(current);
  }
  return declarations;
}

function findPropertySeparator(declaration: string): number {
  let quote: "\"" | "'" | undefined;
  let escaped = false;
  let parenthesesDepth = 0;

  for (let index = 0; index < declaration.length; index++) {
    const character = declaration[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") {
      parenthesesDepth++;
      continue;
    }
    if (character === ")") {
      parenthesesDepth = Math.max(0, parenthesesDepth - 1);
      continue;
    }
    if (character === ":" && parenthesesDepth === 0) {
      return index;
    }
  }
  return -1;
}

export function parseInlineDeclarations(style: string): InlineDeclarationEntry[] {
  if (!style || typeof style !== "string") {
    return [];
  }

  const result: InlineDeclarationEntry[] = [];
  for (const rawDeclaration of splitDeclarationText(style)) {
    const separatorIndex = findPropertySeparator(rawDeclaration);
    if (separatorIndex === -1) {
      continue;
    }

    const property = normalizeProperty(rawDeclaration.slice(0, separatorIndex));
    const rawValue = rawDeclaration.slice(separatorIndex + 1).trim();
    if (!property || !rawValue) {
      continue;
    }

    const parsedValue = splitImportant(rawValue);
    result.push({
      property,
      value: parsedValue.value,
      important: parsedValue.important,
      sourceOrder: result.length,
    });
  }
  return result;
}

/**
 * Parse an inline style attribute into its final property map.
 * Use parseInlineDeclarations when declaration order or !important metadata is required.
 */
export function parseInlineStyle(style: string): Record<string, string> {
  const properties: Record<string, string> = {};
  for (const declaration of parseInlineDeclarations(style)) {
    properties[declaration.property] = declaration.important
      ? `${declaration.value} !important`
      : declaration.value;
  }
  return properties;
}
