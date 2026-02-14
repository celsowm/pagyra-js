import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const sourceDir = path.join(root, "src", "compression", "brotli", "vendor");
const targetDir = path.join(root, "dist", "src", "compression", "brotli", "vendor");

async function main(): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
  console.log(`[copy-brotli-vendor] ${sourceDir} -> ${targetDir}`);
}

main().catch((error) => {
  console.error("[copy-brotli-vendor] failed:", error);
  process.exitCode = 1;
});
