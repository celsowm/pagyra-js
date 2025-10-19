export type LogLevel = 'trace'|'debug'|'info'|'warn'|'error';
let current: { level: LogLevel; cats: Set<string> } = { level: 'warn', cats: new Set() };

export function configureDebug(opts?: { level?: LogLevel; cats?: string[] }) {
  if (!opts) return;
  if (opts.level) current.level = opts.level;
  if (opts.cats)  current.cats = new Set(opts.cats);
}

const order: LogLevel[] = ['trace','debug','info','warn','error'];
export function log(cat: string, level: LogLevel, msg: string, obj?: unknown) {
  if (order.indexOf(level) < order.indexOf(current.level)) return;
  if (current.cats.size && !current.cats.has(cat)) return;
  // keep your preferred output
  obj ? console.log(`[${level}] ${cat} ${msg}`, obj) : console.log(`[${level}] ${cat} ${msg}`);
}
