import { ElementNode, TextNode } from "./core.js";
export { NodeType, ElementNode, TextNode } from "./core.js";

export function helloPagyra(): string {
  const p = new ElementNode("p").append(new TextNode("Olá, Pagyra!"));
  return p.toHTML();
}

// ESM "main" check no estilo NodeNext
import { fileURLToPath } from "node:url";
const isMain = fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) console.log(helloPagyra());
