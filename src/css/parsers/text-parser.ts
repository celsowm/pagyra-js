// src/css/parsers/text-parser.ts

export function parseTextDecorationLine(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const tokens = value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) {
    return undefined;
  }
  if (tokens.includes("none")) {
    return "none";
  }
  const allowed = new Set(["underline", "overline", "line-through"]);
  const matches = tokens.filter((token) => allowed.has(token));
  if (matches.length === 0) {
    return undefined;
  }
  const unique = [...new Set(matches)];
  return unique.join(" ");
}
