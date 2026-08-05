import { WhiteSpace } from "../enums.js";
import type { StyleAccumulator } from "../style.js";
import { registerPropertyParser } from "./registry.js";

export type WhiteSpaceStyleAccumulator = StyleAccumulator & {
  whiteSpace?: WhiteSpace;
};

const WHITE_SPACE_VALUES = new Set<WhiteSpace>([
  WhiteSpace.Normal,
  WhiteSpace.NoWrap,
  WhiteSpace.Pre,
  WhiteSpace.PreWrap,
  WhiteSpace.PreLine,
]);

let registered = false;

export function parseWhiteSpace(value: string, target: StyleAccumulator): void {
  const normalized = value.trim().toLowerCase() as WhiteSpace;
  if (!WHITE_SPACE_VALUES.has(normalized)) {
    return;
  }
  (target as WhiteSpaceStyleAccumulator).whiteSpace = normalized;
}

export function specifiedWhiteSpace(target: StyleAccumulator): WhiteSpace | undefined {
  return (target as WhiteSpaceStyleAccumulator).whiteSpace;
}

export function registerWhiteSpaceParser(): void {
  if (registered) {
    return;
  }
  registered = true;
  registerPropertyParser("white-space", parseWhiteSpace);
}
