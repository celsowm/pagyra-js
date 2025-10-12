export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

export type LogCat = "PARSE" | "STYLE" | "LAYOUT" | "RENDER_TREE" | "PAINT" | "ENCODING" | "FONT" | "PDF";

let CURRENT_LEVEL: LogLevel = "INFO";
let ENABLED: Set<LogCat> = new Set();

export function configureDebug(level: LogLevel, cats: LogCat[] = []) {
  CURRENT_LEVEL = level;
  ENABLED = new Set(cats);
}

const order: LogLevel[] = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"];
function allowed(level: LogLevel, cat: LogCat) {
  return order.indexOf(level) <= order.indexOf(CURRENT_LEVEL) && (ENABLED.size === 0 || ENABLED.has(cat));
}

export function log(cat: LogCat, level: LogLevel, msg: string, extra?: unknown) {
  if (!allowed(level, cat)) return;
  const prefix = `[${cat}] ${level}`;
  extra ? console.log(prefix, msg, extra) : console.log(prefix, msg);
}

export function preview(s: string, n = 60) {
  if (s == null) return s;
  return s.length > n ? s.slice(0, n - 3) + "..." : s;
}
