// Tipos base para o sistema de seletores

export type Combinator = ' ' | '>' | '+' | '~';

export type AttrOp = 'exists' | '=' | '~=' | '|=' | '^=' | '$=' | '*=';

export interface AttrCond {
  name: string;
  op: AttrOp;
  value?: string;
}

export type Pseudo =
  | { kind: 'first-child' }
  | { kind: 'last-child' }
  | { kind: 'nth-child'; a: number; b: number } // an+b (odd=2n+1, even=2n)
  | { kind: 'not'; inner: Simple }              // apenas 1 nível simples
  | { kind: 'root' };

export interface Simple {
  tag: string | null;      // null => universal '*'
  id: string | null;
  classes: string[];
  attrs: AttrCond[];
  pseudos: Pseudo[];
}

export interface Part {
  simple: Simple;
  combinatorToLeft?: Combinator; // combinador imediatamente à esquerda desse "simple"
}
