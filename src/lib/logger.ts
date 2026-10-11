type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const raw = process.env.LOG_LEVEL;
  return raw !== undefined && raw in ORDER ? ORDER[raw as Level] : ORDER.info;
}

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function write(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (ORDER[level] < threshold()) return;
  const entry: Record<string, unknown> = { level, time: new Date().toISOString(), msg };
  for (const [k, v] of Object.entries(fields ?? {})) entry[k] = serialize(v);
  const line = JSON.stringify(entry);
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

/** One-line JSON logs; Vercel and Sentry ingest these as-is. Never log secrets or PII. */
export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => write("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => write("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write("error", msg, fields),
};
