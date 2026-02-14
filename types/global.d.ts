// Global type declarations for third-party modules
// This file provides type declarations for modules that TypeScript cannot resolve

declare module 'rollup/parseAst' {
  export interface ParseAstOptions {
    allowReturnOutsideFunction?: boolean;
    ecmaVersion?: number;
    sourceType?: 'module' | 'script';
  }

  export interface Program {
    type: 'Program';
    body: any[];
    sourceType: 'module' | 'script';
  }

  export function parseAst(code: string, options?: ParseAstOptions): Program;
  export function parseAstAsync(code: string, options?: ParseAstOptions): Promise<Program>;
}
