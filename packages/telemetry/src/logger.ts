// P1-OBS-005 — structured JSON logger with automatic secret redaction.
// Every field is scrubbed before emit: a logged credential is a breach, so
// redaction lives in the single choke point, not in caller discipline.
import { scrubSecrets } from '@yantra/contracts';
import { createCorrelationId, currentCorrelationId } from './context.js';

// Re-exported so log/audit call sites share one scrub implementation.
export { scrubSecrets };
export const redactSecrets = scrubSecrets;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface LogRecord {
  ts: string;
  level: LogLevel;
  scope: string;
  correlationId?: string;
  msg: string;
  fields?: Record<string, unknown>;
}

export type LogSink = (line: string) => void;

export interface Logger {
  debug: (msg: string, fields?: Record<string, unknown>) => void;
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
  error: (msg: string, fields?: Record<string, unknown>) => void;
}

const defaultSink: LogSink = (line: string) => {
  process.stdout.write(`${line}\n`);
};

let droppedLogLines = 0;

export function droppedLogCount(): number {
  return droppedLogLines;
}

export function createLogger(
  scope: string,
  sink: LogSink = defaultSink,
  level: LogLevel = 'info',
  correlationId?: string,
): Logger {
  const cleanScope = scope.replace(/[\r\n]/g, ' ');
  let fallbackId: string | undefined;
  const emit = (entryLevel: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (LEVEL_ORDER[entryLevel] < LEVEL_ORDER[level]) {
      return;
    }
    // Resolved per emit: ambient request scope wins, an explicitly pinned id
    // wins over ambient, otherwise a stable logger fallback. A logger created
    // outside a request must never stamp its birth id onto request logs.
    const resolved =
      correlationId ?? currentCorrelationId() ?? (fallbackId ??= createCorrelationId());
    const record: LogRecord = {
      ts: new Date().toISOString(),
      level: entryLevel,
      scope: cleanScope,
      correlationId: resolved,
      msg: redactSecrets(msg),
      ...(fields ? { fields: redactSecrets(fields) as Record<string, unknown> } : {}),
    };
    try {
      sink(JSON.stringify(record));
    } catch {
      droppedLogLines += 1;
    }
  };
  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
  };
}
