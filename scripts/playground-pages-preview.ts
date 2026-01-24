#!/usr/bin/env tsx
import express from "express";
import path from "node:path";
import { cp, mkdir } from "node:fs/promises";
import { buildBrowserBundle } from "./browser-build.js";

const args = process.argv.slice(2);
const getArg = (prefix: string): string | undefined => {
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
};

const port = Number.parseInt(getArg("--port=") ?? process.env.PORT ?? "", 10) || 5177;
const buildOnly = args.includes("--build-only");

const PUBLIC_DIR = path.resolve("playground", "public");
const ENTRY = "playground/browser-entry.ts";
const OUTFILE = "playground/public/vendor/pagyra-playground-browser.js";
const FONT_SRC = path.resolve("assets", "fonts");
const FONT_DEST = path.resolve(PUBLIC_DIR, "assets", "fonts");

async function buildPlaygroundBundle() {
  await mkdir(path.dirname(path.resolve(OUTFILE)), { recursive: true });
  await buildBrowserBundle({
    entry: ENTRY,
    outfile: OUTFILE,
    minify: false,
    sourcemap: true,
  });
}

async function syncFonts() {
  await mkdir(FONT_DEST, { recursive: true });
  await cp(FONT_SRC, FONT_DEST, { recursive: true });
}

async function startPreviewServer() {
  const app = express();

  app.get("/mode.js", (_req, res) => {
    res.type("application/javascript");
    res.send(
      [
        'window.__PLAYGROUND_MODE = "browser";',
        "window.__PAGYRA_FONT_BASE = new URL(\"./assets/fonts/\", window.location.href).toString();",
      ].join("\n"),
    );
  });

  app.use(express.static(PUBLIC_DIR));

  const server = app.listen(port, () => {
    console.log(`[playground:pages] preview http://localhost:${port}`);
  });

  const cleanup = () => {
    server.close(() => console.log("[playground:pages] preview stopped"));
    process.exit();
  };

  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
}

async function main() {
  await buildPlaygroundBundle();
  await syncFonts();

  if (!buildOnly) {
    await startPreviewServer();
  }
}

main().catch((error) => {
  console.error("[playground:pages] failed:", error);
  process.exit(1);
});
