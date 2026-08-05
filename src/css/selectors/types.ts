// Tipos base para o sistema de seletores

export type Combinator = " " | ">" | "+" | "~";

export type AttrOp = "exists" | "=" | "~=" | "|=" | "^=" | "$=" | "*=";

export interface AttrCond {
  name: string;
  op: AttrOp;
  value?: string;
}

export type Pseudo =
  | { kind: "first-child" }
  | { kind: "last-child" }
  | { kind: "only-child" }
  | { kind: "nth-child"; a: number; b: number }
  | { kind: "first-of-type" }
  | { kind: "last-of-type" }
  | { kind: "only-of-type" }
  | { kind: "nth-of-type"; a: number; b: number }
  | { kind: "empty" }
  | { kind: "not"; inner: Simple }
  | { kind: "root" };

export interface Simple {
  tag: string | null;
  id: string | null;
  classes: string[];
  attrs: AttrCond[];
  pseudos: Pseudo[];
}

export interface Part {
  simple: Simple;
  combinatorToLeft?: Combinator;
}
