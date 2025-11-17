export interface ParsedFont {
  flavor: number;
  numTables: number;
  tables: Record<string, Uint8Array>;
}
