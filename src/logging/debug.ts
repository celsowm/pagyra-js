export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
type DebugConfig = { level: LogLevel; cats: Set<string> };

const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: '\x1b[90m',
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const CATEGORY_COLORS: Record<string, string> = {
  parse: '\x1b[95m',
  style: '\x1b[94m',
  layout: '\x1b[96m',
  paint: '\x1b[93m',
  font: '\x1b[92m',
  encoding: '\x1b[35m',
  pdf: '\x1b[91m',
};

export const LOG_CATEGORIES = Object.keys(CATEGORY_COLORS);

const RESET = '\x1b[0m';
const DEFAULT_CAT_COLOR = '\x1b[37m';
const order: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

let current: DebugConfig = { level: 'warn', cats: new Set() };

/**
 * Configure runtime logging. Categories are compared case-insensitively.
 */
export function configureDebug(opts?: { level?: LogLevel; cats?: string[] }) {
  if (!opts) return;
  if (opts.level) current.level = opts.level;
  if (opts.cats) current.cats = new Set(opts.cats.map((cat) => cat.toLowerCase()));
}

export function log(cat: string, level: LogLevel, msg: string, obj?: unknown) {
  const levelKey = (level as string).toLowerCase() as LogLevel;
  const normalizedCat = cat.toLowerCase();
  const configuredLevel = order.includes(current.level) ? current.level : 'warn';
  if (!order.includes(levelKey)) return;
  if (order.indexOf(levelKey) < order.indexOf(configuredLevel)) return;
  if (current.cats.size && !current.cats.has(normalizedCat)) return;

  const levelColor = LEVEL_COLORS[levelKey] ?? '';
  const catColor = CATEGORY_COLORS[normalizedCat] ?? DEFAULT_CAT_COLOR;
  const prefix = `${levelColor}[${levelKey.toUpperCase()}]${RESET} ${catColor}${cat}${RESET}`;

  if (obj !== undefined) {
    console.log(prefix, msg, obj);
  } else {
    console.log(prefix, msg);
  }
}
// Note: This is the core logging function for pagyra-js, so it uses console.log directly.
// All other console.log statements should be replaced with calls to this log function.
