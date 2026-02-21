import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const sourceDir = path.join(root, "assets", "fonts");
const targetDir = path.join(root, "dist", "assets", "fonts");

async function main(): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
  console.log(`[copy-font-assets] ${sourceDir} -> ${targetDir}`);
}

main().catch((error) => {
  console.error("[copy-font-assets] failed:", error);
  process.exitCode = 1;
});
