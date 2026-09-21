// P1-OBS-005 — correlation context. AsyncLocalStorage carries the request
// correlation ID across awaits so every log line in a request shares it
// without threading parameters through every function.
import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage<{ correlationId: string }>();

export function createCorrelationId(): string {
  return crypto.randomUUID();
}

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return store.run({ correlationId }, fn);
}

export function currentCorrelationId(): string | undefined {
  return store.getStore()?.correlationId;
}
