import { configureDebug as configureNewDebug, log as newLog, type LogLevel as NewLogLevel } from "../logging/debug.js";

/**
 * @deprecated Use src/logging/debug.ts instead. This shim forwards to the new logger.
 */
export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

export type LogCat = "PARSE" | "STYLE" | "LAYOUT" | "RENDER_TREE" | "PAINT" | "ENCODING" | "FONT" | "SHADING" | "PDF" | "PAINT_TRACE";

const LEVEL_MAP: Record<LogLevel, NewLogLevel> = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
  TRACE: "trace",
};

let warned = false;
function warnDeprecated(): void {
  if (!warned) {
    console.warn("[pagyra] src/debug/log.ts is deprecated; import from src/logging/debug.ts instead.");
    warned = true;
  }
}

function normalizeCategory(cat: LogCat): string {
  switch (cat) {
    case "RENDER_TREE":
      return "layout";
    case "PAINT_TRACE":
    case "SHADING":
      return "paint";
    default:
      return cat.toLowerCase();
  }
}

export function configureDebug(level: LogLevel, cats: LogCat[] = []): void {
  warnDeprecated();
  const normalizedCats = cats.map(normalizeCategory);
  configureNewDebug({ level: LEVEL_MAP[level], cats: normalizedCats });
}

export function log(cat: LogCat, level: LogLevel, msg: string, extra?: unknown): void {
  warnDeprecated();
  newLog(normalizeCategory(cat), LEVEL_MAP[level], msg, extra);
}

export function preview(s: string, n = 60) {
  if (s == null) return s;
  return s.length > n ? s.slice(0, n - 3) + "..." : s;
}
