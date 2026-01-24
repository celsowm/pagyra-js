// Type shim for rollup/parseAst module
// This provides type definitions for the parseAst export from rollup

export interface ParseAstOptions {
  allowReturnOutsideFunction?: boolean;
  jsx?: boolean;
}

export interface ProgramNode {
  type: string;
  body: any[];
  sourceType?: 'module' | 'script';
}

export type ParseAst = (
  input: string,
  options?: ParseAstOptions
) => ProgramNode;

export type ParseAstAsync = (
  input: string,
  options?: ParseAstOptions
) => Promise<ProgramNode>;

export const parseAst: ParseAst;
export const parseAstAsync: ParseAstAsync;
