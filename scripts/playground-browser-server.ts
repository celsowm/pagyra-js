#!/usr/bin/env tsx
import express from "express";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { buildBrowserBundle } from "./browser-build.js";

const PORT = Number.parseInt(process.env.PORT ?? "", 10) || 5177;
const PUBLIC_DIR = path.resolve("playground", "public");
const ENTRY = "playground/browser-entry.ts";
const OUTFILE = "playground/public/vendor/pagyra-playground-browser.js";

async function start() {
  await mkdir(path.dirname(path.resolve(OUTFILE)), { recursive: true });
  const buildResult = await buildBrowserBundle({
    entry: ENTRY,
    outfile: OUTFILE,
    minify: false,
    sourcemap: true,
    watch: true,
    onRebuild(error) {
      if (error) {
        console.error("[playground bundle] rebuild failed:", error);
      } else {
        console.log("[playground bundle] rebuild finished.");
      }
    },
  });

  const app = express();

  app.get("/mode.js", (_req, res) => {
    res.type("application/javascript");
    res.send('window.__PLAYGROUND_MODE = "browser";');
  });

  // Expose shared assets (fonts, images) for the browser bundle.
  app.use("/assets", express.static(path.resolve("assets")));
  app.use(express.static(PUBLIC_DIR));

  const server = app.listen(PORT, () => {
    console.log(`[playground:browser] serving http://localhost:${PORT}`);
  });

  const cleanup = async () => {
    server.close(() => console.log("[playground:browser] server stopped"));
    await buildResult.stop?.();
    process.exit();
  };

  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
}

start().catch((error) => {
  console.error("[playground:browser] failed to start:", error);
  process.exit(1);
});
