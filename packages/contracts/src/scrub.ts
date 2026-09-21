// Canonical secret scrubbing (dependency leaf — every package uses this, so
// redaction rules cannot diverge between logs, audit payloads, and errors).
import { redactDatabaseUrl } from './env.js';

const SENSITIVE_EXACT = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'setcookie',
  'privatekey',
  'clientsecret',
  'databaseurl',
]);
const SENSITIVE_PARTS = ['secret', 'password', 'passwd', 'token'];

function isSensitiveKey(key: string): boolean {
  const flat = key.toLowerCase().replace(/[^a-z]/g, '');
  if (SENSITIVE_EXACT.has(flat)) {
    return true;
  }
  return SENSITIVE_PARTS.some((part) => flat.includes(part));
}

function scrubString(value: string): string {
  if (/^(Bearer|Basic|Token)\s+\S+/i.test(value)) {
    return '[REDACTED]';
  }
  if (/^postgres(ql)?:\/\//i.test(value)) {
    try {
      return redactDatabaseUrl(value);
    } catch {
      return '[REDACTED]';
    }
  }
  // Embedded assignments (token=abc, password: "x y") — the common way a
  // secret lands in free text. Plain prose without a separator is untouched.
  return value.replace(
    /(password|passwd|secret|token|api[_-]?key|access[_-]?token)(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,'";]+)/gi,
    '$1$2[REDACTED]',
  );
}

export function scrubSecrets<T>(value: T, depth = 0): T {
  if (depth > 10) {
    return '[REDACTED]' as unknown as T;
  }
  if (typeof value === 'string') {
    return scrubString(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubSecrets(item, depth + 1)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      // Prototype keys are dropped, never assigned (see telemetry tests).
      // Symbol keys never reach JSON sinks either way.
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      out[key] = isSensitiveKey(key) ? '[REDACTED]' : scrubSecrets(entry, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}
