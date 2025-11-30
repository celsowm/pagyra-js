export function readFileSync(_path: string): never {
  throw new Error("readFileSync is not available in browser bundle");
}

export default {};
